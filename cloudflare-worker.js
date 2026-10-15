const API_PREFIX = "/api";
const ALLOWED_METHODS = "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS";
const ALLOWED_HEADERS = "Authorization,Content-Type,Accept,X-Requested-With";

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function isApiPath(pathname) {
  return pathname === API_PREFIX || pathname.startsWith(API_PREFIX + "/");
}

function allowedOrigins(env) {
  return new Set(
    String(env.KATLEARN_ALLOWED_ORIGINS || "")
      .split(",")
      .map(normalizeOrigin)
      .filter(Boolean)
  );
}

function corsHeaders(origin) {
  const headers = new Headers({
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function jsonError(message, status, headers) {
  return Response.json({ ok: false, error: message }, { status, headers });
}

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);

    // Workers Static Assets serves ordinary files directly. The Worker only
    // needs to run first for /api and /api/*, as configured in wrangler.toml.
    if (!isApiPath(incoming.pathname)) {
      if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
        return env.ASSETS.fetch(request);
      }
      return new Response("Static assets binding ASSETS is not configured.", {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const origin = normalizeOrigin(request.headers.get("Origin"));
    const sameOrigin = Boolean(origin) && origin === incoming.origin;
    const allowed = allowedOrigins(env);
    if (origin && !sameOrigin && !allowed.has(origin)) {
      return jsonError("Origin is not allowed.", 403, {
        "Vary": "Origin",
        "Cache-Control": "no-store",
      });
    }

    const cors = corsHeaders(origin && (sameOrigin || allowed.has(origin)) ? origin : "");
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const api = env.KATLEARN_API;
    if (!api || typeof api.fetch !== "function") {
      return jsonError(
        "Cloudflare API service binding KATLEARN_API is not configured.",
        503,
        cors,
      );
    }

    const target = new URL(incoming.pathname + incoming.search, "https://katlearn-api.internal");
    const forwarded = new Request(target, request);
    try {
      const upstream = await api.fetch(forwarded);
      const headers = new Headers(upstream.headers);
      headers.delete("access-control-allow-origin");
      headers.delete("access-control-allow-credentials");
      for (const [key, value] of cors.entries()) headers.set(key, value);
      if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    } catch (error) {
      console.error("[KatLearn API service binding]", error?.name || "Error");
      return jsonError("Cloudflare API Worker is temporarily unavailable.", 502, cors);
    }
  },
};
