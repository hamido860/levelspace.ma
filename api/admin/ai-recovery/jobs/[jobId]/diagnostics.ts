import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AiCommandCenterHttpError,
  getServerSupabase,
  loadAiRecoveryJobDiagnostics,
  requireAdminUser,
} from "../../../../_lib/aiCommandCenter";

function readJobId(req: VercelRequest) {
  const value = req.query.jobId;
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAdminUser(req);
    const jobId = readJobId(req);

    if (!jobId) {
      return res.status(400).json({ error: "jobId is required" });
    }

    const supabase = getServerSupabase();
    const diagnostics = await loadAiRecoveryJobDiagnostics(supabase, jobId);
    return res.status(200).json({ diagnostics });
  } catch (error) {
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load job diagnostics.",
    });
  }
}
