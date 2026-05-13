import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleDeleteUserAiKey } from "../../../src/server/api/userAiKeys";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const provider = Array.isArray(req.query.provider) ? req.query.provider[0] : req.query.provider;
  return handleDeleteUserAiKey(req, res, provider);
}
