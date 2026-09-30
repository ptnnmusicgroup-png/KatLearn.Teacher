const LMS_ADMIN = "https://lms-katlearn.vercel.app/api/admin-hub";

const ALLOWED_ORIGINS = new Set([
  "https://teacher-katlearn.vercel.app",
  "https://lms-katlearn.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
]);

function corsHeaders(origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };

  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "authorization, content-type, accept";
    headers["Vary"] = "Origin";
  }

  return headers;
}

function jsonError(message, code, status, origin) {
  return new Response(
    JSON.stringify({ ok: false, error: message, code }),
    { status, headers: corsHeaders(origin) },
  );
}

async function proxy(request) {
  const origin = request.headers.get("origin") || "";

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return jsonError(
      "Method not allowed",
      "method_not_allowed",
      405,
      origin,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 52000);

  try {
    const url = new URL(LMS_ADMIN);
    const incomingUrl = new URL(request.url);

    for (const [key, value] of incomingUrl.searchParams) {
      url.searchParams.set(key, value);
    }

    const headers = {
      Accept: "application/json",
    };

    const authorization = request.headers.get("authorization");
    if (authorization) {
      headers.Authorization = authorization;
    }

    const contentType = request.headers.get("content-type");
    if (contentType) {
      headers["Content-Type"] = contentType;
    }

    const body = request.method === "POST" ? await request.text() : undefined;

    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = await upstream.text();
    const responseHeaders = {
      ...corsHeaders(origin),
      "Content-Type":
        upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    };

    return new Response(payload, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const aborted = error?.name === "AbortError";

    return jsonError(
      aborted
        ? "Admin Hub upstream phản hồi quá lâu."
        : "Không kết nối được Admin Hub upstream.",
      aborted ? "admin_upstream_timeout" : "admin_proxy_failed",
      aborted ? 504 : 502,
      origin,
    );
  } finally {
    clearTimeout(timeout);
  }
}

// Vercel Node.js Functions use the Web Handler export shape for /api functions.
// Keep this as a fetch handler instead of a legacy default(request) signature.
export default {
  fetch: proxy,
};
