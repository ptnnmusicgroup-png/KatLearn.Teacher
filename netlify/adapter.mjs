export function wrap(endpoint) {
  return async (request, context) => {
    const handler = typeof endpoint === "function"
      ? endpoint
      : (endpoint && typeof endpoint.fetch === "function" ? endpoint.fetch : null);
    if (!handler) {
      return Response.json(
        { ok: false, error: "Netlify API handler is not configured." },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }
    return await handler(request, context);
  };
}
