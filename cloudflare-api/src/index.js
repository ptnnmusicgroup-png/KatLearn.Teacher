import { DurableObject } from "cloudflare:workers";

const PORT = 8080;
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
const START_RETRIES = 100;
const RETRY_DELAY_MS = 200;

function containerEnvironment(env) {
  return {
    NODE_ENV: "production",
    PORT: String(PORT),
    KATLEARN_BACKEND_MODE: "teacher",
    FIREBASE_SERVICE_ACCOUNT_JSON: String(env.FIREBASE_SERVICE_ACCOUNT_JSON || ""),
    FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: String(env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 || ""),
    FIREBASE_ADMIN_SERVICE_ACCOUNT: String(env.FIREBASE_ADMIN_SERVICE_ACCOUNT || ""),
    FIREBASE_PROJECT_ID: String(env.FIREBASE_PROJECT_ID || ""),
    FIREBASE_CLIENT_EMAIL: String(env.FIREBASE_CLIENT_EMAIL || ""),
    FIREBASE_PRIVATE_KEY: String(env.FIREBASE_PRIVATE_KEY || ""),
    KATLEARN_ALLOWED_ORIGINS: String(env.KATLEARN_ALLOWED_ORIGINS || ""),
    KATLEARN_LMS_SITE_URL: String(env.KATLEARN_LMS_SITE_URL || ""),
    KATLEARN_TEACHER_SITE_URL: String(env.KATLEARN_TEACHER_SITE_URL || ""),
  };
}

export class KatLearnApi extends DurableObject {
  starting;

  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    if (ctx.container.running) {
      void ctx.blockConcurrencyWhile(() => ctx.container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS));
    }
  }

  async fetch(request) {
    this.starting ??= this.startAndWaitForPort().finally(() => { this.starting = undefined; });
    try {
      await this.starting;
      const url = new URL(request.url);
      url.protocol = "http:";
      url.host = "container";
      const forwarded = new Request(url, request);
      forwarded.headers.delete("host");
      return await this.ctx.container.getTcpPort(PORT).fetch(forwarded);
    } catch (error) {
      console.error("[KatLearn Teacher Container]", error?.name || "Error");
      return Response.json({ ok: false, error: "KatLearn Teacher API container is starting or unavailable." }, {
        status: 502,
        headers: { "cache-control": "no-store" },
      });
    }
  }

  async startAndWaitForPort() {
    const container = this.ctx.container;
    if (!container.running) {
      container.start({
        image: container.images.base,
        instance: "basic",
        enableInternet: true,
        env: containerEnvironment(this.env),
      });
    }
    await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);
    const port = container.getTcpPort(PORT);
    let lastError;
    for (let attempt = 0; attempt < START_RETRIES; attempt++) {
      try {
        const response = await port.fetch("http://container/ping", { signal: AbortSignal.timeout(1000) });
        await response.body?.cancel();
        if (!response.ok) throw new Error("Container health check returned " + response.status);
        return;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
    throw new Error("Container did not become ready on port " + PORT, { cause: lastError });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/health" && url.pathname !== "/ping" &&
        url.pathname !== "/api" && !url.pathname.startsWith("/api/")) {
      return Response.json({ ok: false, error: "Route not found." }, { status: 404 });
    }
    return env.KATLEARN_API.getByName("primary").fetch(request);
  },
};
