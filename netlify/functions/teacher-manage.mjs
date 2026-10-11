import apiHandler from "../../api/teacher-manage.js";
import { runWebHandler } from "../web-handler.mjs";

export const handler = (event, context) => runWebHandler(event, context, apiHandler);
