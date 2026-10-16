import handler from "../../api/admin-hub.js";
import { invokeWebApi } from "../lib/web-api.mjs";

export const config = { path: "/api/admin-hub" };

export default function netlifyHandler(request, context) {
  return invokeWebApi(handler, request, context);
}
