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

  const configuredApiOrigin = normalizeOrigin(env.KATLEARN_API_ORIGIN);
  if (!configuredApiOrigin) {
    return Response.json(
      { ok: false, error: "Cloudflare Pages API bridge is not configured. Set KATLEARN_API_ORIGIN." },
      { status: 503, headers: cors },
    );
  }

  let apiBase;
  try {
    apiBase = new URL(configuredApiOrigin);
  } catch {
    return Response.json({ ok: false, error: "KATLEARN_API_ORIGIN is invalid." }, { status: 500, headers: cors });
  }
  if (apiBase.protocol !== "https:" && apiBase.hostname !== "localhost") {
    return Response.json({ ok: false, error: "KATLEARN_API_ORIGIN must use HTTPS." }, { status: 500, headers: cors });
  }

  const target = new URL(incoming.pathname + incoming.search, apiBase.origin);
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.delete("host");
  const init = { method: request.method, headers: forwardedHeaders, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;

  try {
    const upstream = await fetch(new Request(target, init));
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
      { ok: false, error: "API server is temporarily unreachable." },
      { status: 502, headers: cors },
    );
  }
}
