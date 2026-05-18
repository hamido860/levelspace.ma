import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleTestUserAiKey } from "../../../src/server/api/userAiKeys";

export default function handler(req: VercelRequest, res: VercelResponse) {
  return handleTestUserAiKey(req, res);
}
