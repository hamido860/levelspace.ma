import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  COMMAND_CENTER_AGENTS,
  buildExecutionPlan,
  createTaskLog,
  fetchTaskBundle,
  getServerSupabase,
  updateTaskStatus,
} from "./_lib/aiCommandCenter";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { task_id } = req.body as { task_id?: string; issue_id?: string };
    if (!task_id) {
      return res.status(400).json({ error: "task_id is required" });
    }

    const supabase = getServerSupabase();
    const { task, issue } = await fetchTaskBundle(supabase, task_id);
    const plan = buildExecutionPlan(task, issue);

    await updateTaskStatus(supabase, task_id, "planning", 15);
    await createTaskLog(
      supabase,
      task_id,
      COMMAND_CENTER_AGENTS.planner,
      "info",
      `Planner created an execution plan with ${plan.riskLevel} risk.`,
      plan,
    );

    return res.status(200).json(plan);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unable to build plan." });
  }
}
