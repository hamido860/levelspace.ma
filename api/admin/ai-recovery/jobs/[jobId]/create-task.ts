import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AiCommandCenterHttpError,
  createAiRecoveryTaskForJob,
  getServerSupabase,
  requireAdminUser,
} from "../../../../_lib/aiCommandCenter";

function readJobId(req: VercelRequest) {
  const value = req.query.jobId;
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user } = await requireAdminUser(req);
    const jobId = readJobId(req);

    if (!jobId) {
      return res.status(400).json({ error: "jobId is required" });
    }

    const supabase = getServerSupabase();
    const result = await createAiRecoveryTaskForJob(supabase, jobId, user.id);
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to create AI recovery task.",
    });
  }
}
