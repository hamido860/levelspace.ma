import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AiCommandCenterHttpError,
  getServerSupabase,
  requireAiAdmin,
  runMonitoringSweep,
} from "./_lib/aiCommandCenter";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAiAdmin(req);
    const { run_type } = req.body as { run_type?: string };
    const supabase = getServerSupabase();
    const result = await runMonitoringSweep(supabase, run_type || "manual");
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unable to run monitoring." });
  }
}
