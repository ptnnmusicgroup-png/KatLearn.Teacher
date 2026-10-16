export async function invokeWebApi(handler, request, context) {
  try {
    let response;
    if (typeof handler === "function") response = await handler(request, context);
    else if (handler && typeof handler.fetch === "function") response = await handler.fetch(request, context);

    if (response instanceof Response) return response;
    return Response.json(
      { ok: false, error: "API handler returned an invalid response." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[KatLearn Netlify API]", error?.name || "Error");
    return Response.json(
      { ok: false, error: "The API could not process this request." },
      { status: Number(error?.statusCode || error?.status) || 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
