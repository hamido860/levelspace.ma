import type { VercelRequest, VercelResponse } from "@vercel/node";
import { AiCommandCenterHttpError, getServerSupabase, requireAiAdmin, runRagDiagnostic } from "./_lib/aiCommandCenter";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await requireAiAdmin(req);
    const body = req.body as {
      grade_id?: string | null;
      subject_id?: string | null;
      topic_id?: string | null;
      lesson_id?: string | null;
    };

    const supabase = getServerSupabase();
    const diagnostic = await runRagDiagnostic(supabase, body);
    return res.status(200).json(diagnostic);
  } catch (error) {
    if (error instanceof AiCommandCenterHttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unable to run RAG diagnostic." });
  }
}
