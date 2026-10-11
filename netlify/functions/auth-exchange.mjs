import apiHandler from "../../api/auth-exchange.js";
import { runWebHandler } from "../web-handler.mjs";

export const handler = (event, context) => runWebHandler(event, context, apiHandler);
