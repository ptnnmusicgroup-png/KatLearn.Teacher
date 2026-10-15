const API_PREFIX = "/api";
const ALLOWED_METHODS = "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS";
const ALLOWED_HEADERS = "Authorization,Content-Type,Accept,X-Requested-With";

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/+$/, "");
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
  });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

export async function onRequest({ request, env, next }) {
  const incoming = new URL(request.url);
  if (incoming.pathname !== API_PREFIX && !incoming.pathname.startsWith(API_PREFIX + "/")) {
    return next();
  }

  const origin = normalizeOrigin(request.headers.get("Origin"));
  const sameOrigin = origin && origin === incoming.origin;
  const allowed = allowedOrigins(env);
  if (origin && !sameOrigin && !allowed.has(origin)) {
    return Response.json({ ok: false, error: "Origin is not allowed." }, { status: 403 });
  }

  const cors = corsHeaders(origin && (sameOrigin || allowed.has(origin)) ? origin : "");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const api = env.KATLEARN_API;
  if (!api || typeof api.fetch !== "function") {
    return Response.json(
      { ok: false, error: "Cloudflare API service binding KATLEARN_API is not configured." },
      { status: 503, headers: cors },
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
    headers.set("Cache-Control", headers.get("Cache-Control") || "no-store");
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch {
    return Response.json(
      { ok: false, error: "Cloudflare API Worker is temporarily unavailable." },
      { status: 502, headers: cors },
    );
  }
}
