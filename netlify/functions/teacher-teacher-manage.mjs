import handler from "../../api/teacher-manage.js";
import { invokeWebApi } from "../lib/web-api.mjs";

export const config = { path: "/api/teacher-manage" };

export default function netlifyHandler(request, context) {
  return invokeWebApi(handler, request, context);
}
