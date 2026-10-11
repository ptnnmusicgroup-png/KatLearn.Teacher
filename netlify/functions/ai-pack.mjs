import apiHandler from "../../api/ai-pack.js";
import { runWebHandler } from "../web-handler.mjs";

export const handler = (event, context) => runWebHandler(event, context, apiHandler);
