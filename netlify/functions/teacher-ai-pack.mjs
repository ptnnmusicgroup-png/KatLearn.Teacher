import handler from "../../api/ai-pack.js";
import { invokeWebApi } from "../lib/web-api.mjs";

export const config = { path: "/api/ai-pack" };

export default function netlifyHandler(request, context) {
  return invokeWebApi(handler, request, context);
}
