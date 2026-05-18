import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleDeleteUserAiKey } from "../../../src/server/api/userAiKeys";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const provider = typeof req.query.provider === "string" ? req.query.provider : undefined;
  return handleDeleteUserAiKey(req, res, provider);
}
