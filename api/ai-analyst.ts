import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const nvidiaKey = process.env.NVIDIA_API_KEY || process.env.VITE_NVIDIA_API_KEY;
  if (!nvidiaKey || nvidiaKey === "MY_NVIDIA_API_KEY") {
    return res.status(503).json({ error: "NVIDIA API key not configured. Add NVIDIA_API_KEY to your Vercel environment variables." });
  }

  const { metrics, action } = req.body as {
    metrics: any;
    action: "insights" | "tasks" | "strategy" | "retry_failed";
  };

  if (!metrics) return res.status(400).json({ error: "metrics payload required" });

  if (action === "retry_failed") {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return res.status(503).json({ error: "Supabase not configured" });
    }
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase
        .from("lesson_gen_queue")
        .update({ status: "pending", attempts: 0, last_error: null, claimed_at: null })
        .eq("status", "failed");
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, message: `Reset ${metrics.failedJobs} failed jobs back to pending.` });
    } catch (err: any) {
      return res.status(500).json({ error: err.message ?? "Unknown error during retry" });
    }
  }

  const systemPrompt = `You are an AI analyst for HamidEduApp, a Moroccan educational platform that generates AI lessons for grades 1–12 (Primaire, Collège, Lycée).
You interpret database metrics and give sharp, actionable insights in clear English.
You always structure your output as valid JSON matching exactly the requested action format.
Be specific — reference actual numbers from the metrics. Be concise but complete.`;

  const actionPrompts: Record<string, string> = {
    insights: `Analyze these database metrics and return JSON:
{
  "summary": "2-3 sentence executive summary of the overall state",
  "highlights": [ { "type": "warning|success|info", "title": "...", "detail": "..." } ],
  "bottlenecks": [ { "area": "...", "severity": "high|medium|low", "description": "..." } ]
}`,
    tasks: `Based on these metrics, return a prioritized task list as JSON:
{
  "tasks": [
    {
      "id": 1,
      "priority": "critical|high|medium|low",
      "title": "...",
      "description": "...",
      "metric_basis": "the specific number that drives this task",
      "estimated_impact": "what improves if done",
      "action_type": "fix|generate|review|optimize"
    }
  ]
}
Return 6-8 tasks ordered by priority.`,
    strategy: `Create a strategic plan based on these metrics as JSON:
{
  "goal": "One-sentence strategic goal",
  "phases": [
    {
      "phase": 1,
      "name": "...",
      "duration": "e.g. 1 week",
      "objectives": ["...", "..."],
      "key_metric": "what to measure to know this phase is done",
      "actions": ["...", "..."]
    }
  ],
  "success_criteria": ["...", "..."],
  "risks": [ { "risk": "...", "mitigation": "..." } ]
}
Return 3 phases.`,
  };

  const userPrompt = `Here are the live metrics from the database:\n\n${JSON.stringify(metrics, null, 2)}\n\n${actionPrompts[action]}`;

  try {
    const response = await axios.post(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        model: "qwen/qwen3-coder-480b-a35b-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${nvidiaKey}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );

    const raw = response.data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(raw); }
    catch { parsed = { raw }; }
    return res.json({ ok: true, result: parsed, model: "qwen/qwen3-coder-480b-a35b-instruct" });
  } catch (err: any) {
    const msg = err?.response?.data?.detail || err?.response?.data?.message || err.message;
    console.error("[AI Analyst] NVIDIA API error:", msg);
    return res.status(502).json({ error: `NVIDIA API error: ${msg}` });
  }
}
