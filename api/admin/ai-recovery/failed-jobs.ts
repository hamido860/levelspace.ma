import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AiCommandCenterHttpError,
  getServerSupabase,
  loadAiRecoveryFailedJobs,
  requireAdminUser,
} from "../../_lib/aiCommandCenter";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const supabase = getServerSupabase();
    const jobs = await loadAiRecoveryFailedJobs(supabase);
    return res.status(200).json({ jobs });
  } catch (error) {
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load failed jobs.",
    });
  }
}
