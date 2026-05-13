import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleUserAiKeys } from "../../src/server/api/userAiKeys";

export default function handler(req: VercelRequest, res: VercelResponse) {
  return handleUserAiKeys(req, res);
}
