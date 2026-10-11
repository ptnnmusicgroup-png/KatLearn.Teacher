export async function runWebHandler(event, context, apiModule) {
  const headers = new Headers();
  const combined = { ...(event.multiValueHeaders || {}), ...(event.headers || {}) };

  for (const [name, value] of Object.entries(combined)) {
    if (value == null) continue;
    headers.set(name, Array.isArray(value) ? String(value[0] ?? "") : String(value));
  }

  const method = String(event.httpMethod || event.requestContext?.http?.method || "GET").toUpperCase();
  const host = headers.get("host") || "netlify.local";
  const queryText = event.rawQuery ? `?${event.rawQuery}` : "";
  const url = event.rawUrl || `https://${host}${event.path || "/"}${queryText}`;
  let body;

  if (event.body != null && method !== "GET" && method !== "HEAD") {
    body = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : String(event.body);
  }

  try {
    const request = new Request(url, {
      method,
      headers,
      ...(body !== undefined ? { body } : {}),
    });

    const response = typeof apiModule === "function"
      ? await apiModule(request, context)
      : await apiModule.fetch(request, context);

    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text(),
    };
  } catch (error) {
    console.error("[KatLearn Teacher Netlify function]", error?.name || "Error");
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      body: JSON.stringify({ ok: false, error: "Không thể xử lý yêu cầu của cổng Giáo viên." }),
    };
  }
}
