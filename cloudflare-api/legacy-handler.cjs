function normalizeHeaders(event) {
  const output = Object.create(null);
  const combined = { ...(event.multiValueHeaders || {}), ...(event.headers || {}) };
  for (const [name, value] of Object.entries(combined)) {
    if (value == null) continue;
    output[String(name).toLowerCase()] = Array.isArray(value) ? String(value[0] ?? "") : String(value);
  }
  Object.defineProperty(output, "get", {
    enumerable: false,
    value(name) { return output[String(name).toLowerCase()] ?? null; },
  });
  return output;
}
function createResponse() {
  const state = { statusCode: 200, headers: {}, body: "", ended: false };
  const res = {
    get statusCode() { return state.statusCode; },
    set statusCode(code) { state.statusCode = Number(code) || 200; },
    setHeader(name, value) { state.headers[String(name)] = Array.isArray(value) ? value.join(", ") : String(value); return this; },
    getHeader(name) { return state.headers[String(name)]; },
    set(name, value) {
      if (name && typeof name === "object") for (const [key, entry] of Object.entries(name)) this.setHeader(key, entry);
      else this.setHeader(name, value);
      return this;
    },
    status(code) { state.statusCode = Number(code) || 200; this.statusCode = state.statusCode; return this; },
    writeHead(code, headers = {}) { this.status(code); for (const [key, value] of Object.entries(headers)) this.setHeader(key, value); return this; },
    json(value) { if (!state.headers["Content-Type"]) this.setHeader("Content-Type", "application/json; charset=utf-8"); state.body = JSON.stringify(value); state.ended = true; return this; },
    send(value) { state.body = typeof value === "string" ? value : JSON.stringify(value ?? ""); state.ended = true; return this; },
    end(value = "") { state.body = value == null ? "" : String(value); state.ended = true; return this; },
  };
  return { res, state };
}
function toResponse(response) {
  return { statusCode: response.status, headers: Object.fromEntries(response.headers.entries()), body: response.body };
}
module.exports = async function runLegacyHandler(event, context, apiHandler) {
  const headers = normalizeHeaders(event);
  const method = String(event.httpMethod || event.requestContext?.http?.method || "GET").toUpperCase();
  const rawBody = event.body == null ? "" : event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : String(event.body);
  let body = rawBody;
  if (rawBody && String(headers["content-type"] || "").toLowerCase().includes("application/json")) {
    try { body = JSON.parse(rawBody); } catch { /* Let the API handler validate malformed JSON. */ }
  } else if (!rawBody) body = undefined;
  const requestUrl = event.rawUrl || "http://" + (headers.host || "container") + (event.path || "/") + (event.rawQuery ? "?" + event.rawQuery : "");
  const url = new URL(requestUrl);
  const query = Object.fromEntries(url.searchParams.entries());
  const req = { method, headers, body, url: url.pathname + url.search, originalUrl: url.pathname + url.search, path: url.pathname, query, queryStringParameters: event.queryStringParameters || query, rawBody };
  const { res, state } = createResponse();
  try {
    const result = await apiHandler(req, res, context);
    if (result instanceof Response) return toResponse(result);
    if (state.ended) return { statusCode: state.statusCode, headers: state.headers, body: state.body };
    if (result !== undefined) return { statusCode: state.statusCode, headers: state.headers, body: typeof result === "string" ? result : JSON.stringify(result) };
    return { statusCode: state.statusCode, headers: state.headers, body: state.body };
  } catch (error) {
    console.error("[KatLearn Teacher adapter]", error?.name || "Error");
    return { statusCode: Number(error?.statusCode || error?.status) || 500, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify({ ok: false, error: "Máy chủ không thể xử lý yêu cầu." }) };
  }
};
