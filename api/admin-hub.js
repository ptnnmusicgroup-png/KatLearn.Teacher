const DEFAULT_LMS_ADMIN = "https://lms-katlearn.netlify.app/api/admin-hub";

const BUILTIN_ALLOWED_ORIGINS = new Set([
  "https://katlearn-teacher.pages.dev",
  "https://katlearn-lms.pages.dev",
  "https://teacher-katlearn.netlify.app",
  "https://lms-katlearn.netlify.app",
  "http://localhost:3000",
  "http://localhost:5173",
]);

function getLmsAdminUrl() {
  const value = String(process.env.LMS_ADMIN_URL || DEFAULT_LMS_ADMIN).trim();
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("LMS_ADMIN_URL must use HTTPS.");
  }
  return url.toString();
}

function isAllowedOrigin(origin) {
  const configured = String(process.env.KATLEARN_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return BUILTIN_ALLOWED_ORIGINS.has(origin) || configured.includes(origin);
}

function corsHeaders(origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };

  if (isAllowedOrigin(origin)) {
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
    const url = new URL(getLmsAdminUrl());
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

// Netlify Functions adapt the Web Handler export shape for /api functions.
// Keep this as a fetch handler instead of a legacy default(request) signature.
export default {
  fetch: proxy,
};
