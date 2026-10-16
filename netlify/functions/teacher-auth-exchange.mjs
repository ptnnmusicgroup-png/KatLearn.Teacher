import handler from "../../api/auth-exchange.js";
import { invokeWebApi } from "../lib/web-api.mjs";

export const config = { path: "/api/auth-exchange" };

export default function netlifyHandler(request, context) {
  return invokeWebApi(handler, request, context);
}
