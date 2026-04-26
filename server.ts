import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Request logging for ALL requests
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[API DEBUG] ${req.method} ${req.url}`);
    }
    next();
  });

  // Supabase Server-Side Client
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  let supabase: any = null;
  if (supabaseUrl && supabaseKey && supabaseUrl !== 'YOUR_SUPABASE_URL') {
    try {
      supabase = createClient(supabaseUrl, supabaseKey);
      console.log("Supabase server-side client initialized");
    } catch (err) {
      console.error("Failed to initialize Supabase server-side client:", err);
    }
  }

  // Supabase Proxy Endpoint - HIGH PRIORITY
  const handleProxy = async (req: express.Request, res: express.Response) => {
    console.log(`[PROXY EXEC] Handling ${req.method} ${req.url}`);
    res.setHeader('X-Proxy-Handled', 'true');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'GET') {
      return res.json({ message: "Supabase Proxy is active. Use POST to make queries." });
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!supabase) {
      return res.status(503).json({ error: "Supabase not configured on server." });
    }

    const { table, action, data, query } = req.body;
    
    try {
      let result;
      let db;
      if (table) {
          db = supabase.from(table);
      }

      const applyFilters = (q: any) => {
        let currentQuery = q;
        if (query?.filters) {
          query.filters.forEach((filter: any) => {
            switch (filter.type) {
              case 'eq': currentQuery = currentQuery.eq(filter.key, filter.val); break;
              case 'neq': currentQuery = currentQuery.neq(filter.key, filter.val); break;
              case 'gt': currentQuery = currentQuery.gt(filter.key, filter.val); break;
              case 'gte': currentQuery = currentQuery.gte(filter.key, filter.val); break;
              case 'lt': currentQuery = currentQuery.lt(filter.key, filter.val); break;
              case 'lte': currentQuery = currentQuery.lte(filter.key, filter.val); break;
              case 'ilike': currentQuery = currentQuery.ilike(filter.key, filter.val); break;
              case 'like': currentQuery = currentQuery.like(filter.key, filter.val); break;
              case 'in': currentQuery = currentQuery.in(filter.key, filter.val); break;
              case 'contains': currentQuery = currentQuery.contains(filter.key, filter.val); break;
              case 'or': currentQuery = currentQuery.or(filter.val); break;
            }
          });
        }
        if (query?.eq) {
          Object.entries(query.eq).forEach(([key, val]) => {
            currentQuery = currentQuery.eq(key, val);
          });
        }
        return currentQuery;
      };

      switch (action) {
        case 'rpc':
          result = await supabase.rpc(query.fn, data);
          break;
        case 'select':
          let selectQuery = db.select(query?.select || '*');
          selectQuery = applyFilters(selectQuery);
          if (query?.order) selectQuery = selectQuery.order(query.order.column, { ascending: query.order.ascending });
          if (query?.limit) selectQuery = selectQuery.limit(query.limit);
          if (query?.single) result = await selectQuery.single();
          else if (query?.maybeSingle) result = await selectQuery.maybeSingle();
          else result = await selectQuery;
          break;
        case 'insert':
          result = await db.insert(data);
          break;
        case 'update':
          let updateQuery = db.update(data);
          updateQuery = applyFilters(updateQuery);
          result = await updateQuery;
          break;
        case 'upsert':
          result = await db.upsert(data);
          break;
        case 'delete':
          let deleteQuery = db.delete();
          deleteQuery = applyFilters(deleteQuery);
          result = await deleteQuery;
          break;
        default:
          return res.status(400).json({ error: "Invalid action" });
      }

      res.json(result);
    } catch (error) {
      console.error("Supabase Proxy Error:", error);
      res.status(500).json({ error: "Internal server error during Supabase proxy" });
    }
  };

  // Explicitly match the proxy route BEFORE the router or any other middleware
  app.all("/api/supabase/proxy", handleProxy);
  app.all("/api/supabase/proxy/", handleProxy);

  // API Router for other endpoints
  const apiRouter = express.Router();
  apiRouter.get("/health", (req, res) => res.json({ status: "ok", supabase: !!supabase }));

  // ── AI Analyst Agent ──────────────────────────────────────────────────────
  apiRouter.post("/ai-analyst", async (req, res) => {
    const nvidiaKey = process.env.NVIDIA_API_KEY || process.env.VITE_NVIDIA_API_KEY;
    if (!nvidiaKey || nvidiaKey === "MY_NVIDIA_API_KEY") {
      return res.status(503).json({ error: "NVIDIA API key not configured. Add NVIDIA_API_KEY to your .env file." });
    }

    const { metrics, action } = req.body as {
      metrics: any;
      action: "insights" | "tasks" | "strategy" | "retry_failed";
    };

    if (!metrics) return res.status(400).json({ error: "metrics payload required" });

    // ── Auto-retry failed queue jobs ──────────────────────────────────────
    if (action === "retry_failed") {
      if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
      try {
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

    // ── Build prompt from live metrics ────────────────────────────────────
    const systemPrompt = `You are an AI analyst for HamidEduApp, a Moroccan educational platform that generates AI lessons for grades 1–12 (Primaire, Collège, Lycée).
You interpret database metrics and give sharp, actionable insights in clear English.
You always structure your output as valid JSON matching exactly the requested action format.
Be specific — reference actual numbers from the metrics. Be concise but complete.`;

    const actionPrompts: Record<string, string> = {
      insights: `Analyze these database metrics and return JSON:
{
  "summary": "2-3 sentence executive summary of the overall state",
  "highlights": [ { "type": "warning|success|info", "title": "...", "detail": "..." } ],  // 4-6 highlights
  "bottlenecks": [ { "area": "...", "severity": "high|medium|low", "description": "..." } ]  // top 3 bottlenecks
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
Return 3 phases.`
    };

    const userPrompt = `Here are the live metrics from the database:\n\n${JSON.stringify(metrics, null, 2)}\n\n${actionPrompts[action]}`;

    try {
      const response = await axios.post(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          model: "qwen/qwen3-coder-480b-a35b-instruct",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user",   content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 2048,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            Authorization: `Bearer ${nvidiaKey}`,
            "Content-Type": "application/json"
          },
          timeout: 60000
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
  });

  // ── Admin: Retry single failed queue job ──────────────────────────────────
  apiRouter.post("/admin/retry-job", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { jobId } = req.body;
    if (!jobId) return res.status(400).json({ error: "jobId required" });
    try {
      const { error } = await supabase
        .from("lesson_gen_queue")
        .update({ status: "pending", attempts: 0, last_error: null, claimed_at: null })
        .eq("id", jobId);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  });

  // ── Admin: Delete single queue job ────────────────────────────────────────
  apiRouter.post("/admin/delete-job", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { jobId } = req.body;
    if (!jobId) return res.status(400).json({ error: "jobId required" });
    try {
      const { error } = await supabase.from("lesson_gen_queue").delete().eq("id", jobId);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  });

  // ── Admin: Generate lesson for a topic via Qwen ───────────────────────────
  apiRouter.post("/admin/generate-lesson", async (req, res) => {
    const nvidiaKey = process.env.NVIDIA_API_KEY || process.env.VITE_NVIDIA_API_KEY;
    if (!nvidiaKey || nvidiaKey === "MY_NVIDIA_API_KEY") {
      return res.status(503).json({ error: "NVIDIA API key not configured" });
    }
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { topicId, topicTitle, gradeName, subjectName, cycle } = req.body;
    if (!topicId || !topicTitle) return res.status(400).json({ error: "topicId and topicTitle required" });
    try {
      const response = await axios.post(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          model: "qwen/qwen3-coder-480b-a35b-instruct",
          messages: [
            { role: "system", content: "You are an expert educational content creator for Moroccan K-12 students. Return valid JSON only, no markdown." },
            { role: "user", content: `Generate a complete lesson for Moroccan students.\nTopic: "${topicTitle}"\nGrade: ${gradeName || "unknown"}\nSubject: ${subjectName || "unknown"}\nCycle: ${cycle || "unknown"}\n\nReturn JSON:\n{\n  "title": "${topicTitle}",\n  "intro": "2-3 sentence introduction",\n  "blocks": [\n    { "type": "text", "heading": "...", "content": "..." },\n    { "type": "example", "heading": "Example", "content": "..." },\n    { "type": "text", "heading": "Key Concepts", "content": "..." },\n    { "type": "activity", "heading": "Practice", "content": "..." }\n  ],\n  "summary": "2-3 sentence summary",\n  "objectives": ["...", "...", "..."],\n  "keywords": ["...", "...", "..."]\n}` }
          ],
          temperature: 0.3,
          max_tokens: 3000,
          response_format: { type: "json_object" }
        },
        { headers: { Authorization: `Bearer ${nvidiaKey}`, "Content-Type": "application/json" }, timeout: 90000 }
      );
      const raw = response.data?.choices?.[0]?.message?.content ?? "{}";
      let lesson: any;
      try { lesson = JSON.parse(raw); } catch { return res.status(500).json({ error: "Qwen returned invalid JSON" }); }

      const { data: savedLesson, error: saveError } = await supabase
        .from("lessons")
        .insert({ topic_id: topicId, content: lesson, title: lesson.title || topicTitle })
        .select("id")
        .single();
      if (saveError) return res.status(500).json({ error: `DB save failed: ${saveError.message}` });

      await supabase.from("lesson_gen_queue").update({ status: "done" }).eq("topic_id", topicId);
      return res.json({ ok: true, lessonId: savedLesson?.id });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err.message;
      return res.status(502).json({ error: `Generation failed: ${msg}` });
    }
  });

  // ── Admin: Bulk queue missing topics for a grade ───────────────────────────
  apiRouter.post("/admin/bulk-generate", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { gradeId } = req.body;
    if (!gradeId) return res.status(400).json({ error: "gradeId required" });
    try {
      const { data: topics, error: topicsErr } = await supabase.from("topics").select("id").eq("grade_id", gradeId);
      if (topicsErr) return res.status(500).json({ error: topicsErr.message });
      const topicIds = (topics || []).map((t: any) => t.id);
      if (!topicIds.length) return res.json({ ok: true, queued: 0, message: "No topics found for this grade" });

      const { data: existingLessons } = await supabase.from("lessons").select("topic_id").in("topic_id", topicIds);
      const { data: existingQueue } = await supabase.from("lesson_gen_queue").select("topic_id").in("topic_id", topicIds);
      const hasLesson = new Set((existingLessons || []).map((l: any) => l.topic_id));
      const inQueue   = new Set((existingQueue   || []).map((q: any) => q.topic_id));

      const missing = topicIds.filter((id: string) => !hasLesson.has(id) && !inQueue.has(id));
      if (!missing.length) return res.json({ ok: true, queued: 0, message: "All topics already have lessons or are queued" });

      const { error: insertErr } = await supabase.from("lesson_gen_queue").insert(
        missing.map((id: string) => ({ topic_id: id, status: "pending", attempts: 0 }))
      );
      if (insertErr) return res.status(500).json({ error: insertErr.message });
      return res.json({ ok: true, queued: missing.length, message: `Queued ${missing.length} topics` });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  });

  // ── Admin: Repair RAG chunk via Qwen ──────────────────────────────────────
  apiRouter.post("/admin/repair-chunk", async (req, res) => {
    const nvidiaKey = process.env.NVIDIA_API_KEY || process.env.VITE_NVIDIA_API_KEY;
    if (!nvidiaKey || nvidiaKey === "MY_NVIDIA_API_KEY") return res.status(503).json({ error: "NVIDIA API key not configured" });
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { chunkId, content } = req.body;
    if (!chunkId || !content) return res.status(400).json({ error: "chunkId and content required" });
    try {
      const response = await axios.post(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          model: "qwen/qwen3-coder-480b-a35b-instruct",
          messages: [
            { role: "system", content: "You clean and fix educational content chunks for a RAG knowledge base. Return JSON only." },
            { role: "user", content: `Clean and improve this chunk. Return: { "content": "improved text" }\n\nOriginal:\n${content}` }
          ],
          temperature: 0.2,
          max_tokens: 1500,
          response_format: { type: "json_object" }
        },
        { headers: { Authorization: `Bearer ${nvidiaKey}`, "Content-Type": "application/json" }, timeout: 60000 }
      );
      const raw = response.data?.choices?.[0]?.message?.content ?? "{}";
      let result: any;
      try { result = JSON.parse(raw); } catch { return res.status(500).json({ error: "Qwen returned invalid JSON" }); }
      const newContent = result.content || content;
      const { error: updateErr } = await supabase
        .from("rag_chunks")
        .update({ content: newContent, embedding_status: "pending" })
        .eq("id", chunkId);
      if (updateErr) return res.status(500).json({ error: updateErr.message });
      return res.json({ ok: true, content: newContent });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err.message;
      return res.status(502).json({ error: `Repair failed: ${msg}` });
    }
  });

  // ── Admin: Delete RAG chunk ────────────────────────────────────────────────
  apiRouter.post("/admin/delete-chunk", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { chunkId } = req.body;
    if (!chunkId) return res.status(400).json({ error: "chunkId required" });
    try {
      const { error } = await supabase.from("rag_chunks").delete().eq("id", chunkId);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  });

  // ── Admin: Re-embed chunk (reset to pending) ──────────────────────────────
  apiRouter.post("/admin/re-embed-chunk", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { chunkId } = req.body;
    if (!chunkId) return res.status(400).json({ error: "chunkId required" });
    try {
      const { error } = await supabase.from("rag_chunks").update({ embedding_status: "pending" }).eq("id", chunkId);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  });

  // ── Admin: Update any table row ───────────────────────────────────────────
  apiRouter.post("/admin/update-row", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { table, id, data } = req.body;
    if (!table || !id || !data) return res.status(400).json({ error: "table, id, and data required" });
    try {
      const { error } = await supabase.from(table).update(data).eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  });

  // ── Admin: Delete any table row ───────────────────────────────────────────
  apiRouter.post("/admin/delete-row", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { table, id } = req.body;
    if (!table || !id) return res.status(400).json({ error: "table and id required" });
    try {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    } catch (err: any) { return res.status(500).json({ error: err.message }); }
  });

  // ── Admin: Execute AI-generated task (gated executor) ──────────────────────
  apiRouter.post("/admin/exec-task", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Supabase not configured" });
    const { action_type, task_id } = req.body;
    if (!action_type) return res.status(400).json({ error: "action_type required" });

    try {
      // Whitelist of safe, deterministic handlers. No LLM-generated SQL.
      const handlers: Record<string, () => Promise<{ preview: string; executed: boolean; rows_affected?: number; error?: string }>> = {
        // Bulk generate lessons for the grade with lowest coverage
        generate: async () => {
          // Find grade with lowest lesson coverage (missing most lessons)
          const { data: grades, error: gradesErr } = await supabase.from("grades").select("id, name");
          if (gradesErr) throw gradesErr;
          if (!grades || grades.length === 0) {
            return { preview: "No grades found", executed: false };
          }

          // Get topic and lesson counts per grade to find lowest coverage
          const { data: topicsByGrade, error: topicsErr } = await supabase
            .from("topics")
            .select("grade_id");
          if (topicsErr) throw topicsErr;

          const { data: lessonsByGrade, error: lessonsErr } = await supabase
            .from("lessons")
            .select("id, topic_id");
          if (lessonsErr) throw lessonsErr;

          const topicCountByGrade = new Map<string, number>();
          const lessonTopicIds = new Set((lessonsByGrade || []).map((l: any) => l.topic_id));

          (topicsByGrade || []).forEach((t: any) => {
            topicCountByGrade.set(t.grade_id, (topicCountByGrade.get(t.grade_id) || 0) + 1);
          });

          // Find grade with most missing lessons
          let lowestGradeId: string | null = null;
          let maxMissing = 0;

          topicCountByGrade.forEach((topicCount, gradeId) => {
            // Estimate: topics without lessons are "missing"
            const estimatedMissing = topicCount - (lessonsByGrade || []).filter(
              (l: any) => topicsByGrade?.find((t: any) => t.id === l.topic_id && t.grade_id === gradeId)
            ).length;
            if (estimatedMissing > maxMissing) {
              maxMissing = estimatedMissing;
              lowestGradeId = gradeId;
            }
          });

          if (!lowestGradeId) {
            return { preview: "All grades have full lesson coverage", executed: false };
          }

          // Get topics for that grade that don't have lessons yet
          const { data: gradeTopics, error: topicsErr2 } = await supabase
            .from("topics")
            .select("id")
            .eq("grade_id", lowestGradeId);
          if (topicsErr2) throw topicsErr2;

          const topicIds = (gradeTopics || []).map((t: any) => t.id);
          if (!topicIds.length) {
            return { preview: `Grade ${lowestGradeId} has no topics`, executed: false };
          }

          // Filter out topics that already have lessons or are in queue
          const { data: existingLessons } = await supabase
            .from("lessons")
            .select("topic_id")
            .in("topic_id", topicIds);
          const { data: existingQueue } = await supabase
            .from("lesson_gen_queue")
            .select("topic_id")
            .in("topic_id", topicIds);

          const hasLesson = new Set((existingLessons || []).map((l: any) => l.topic_id));
          const inQueue = new Set((existingQueue || []).map((q: any) => q.topic_id));
          const missing = topicIds.filter((id: string) => !hasLesson.has(id) && !inQueue.has(id));

          if (!missing.length) {
            return { preview: `All topics in grade ${lowestGradeId} already have lessons or are queued`, executed: false };
          }

          // Queue the missing topics for generation
          const { error: insertErr } = await supabase
            .from("lesson_gen_queue")
            .insert(missing.map((id: string) => ({ topic_id: id, status: "pending", attempts: 0 })));
          if (insertErr) throw insertErr;

          return {
            preview: `Queue ${missing.length} missing lessons for grade with lowest coverage`,
            executed: true,
            rows_affected: missing.length,
          };
        },

        // Retry all failed queue jobs
        retry_failed: async () => {
          const { error } = await supabase
            .from("lesson_gen_queue")
            .update({ status: "pending", attempts: 0, last_error: null, claimed_at: null })
            .eq("status", "failed");
          if (error) throw error;

          // Get count of updated rows
          const { count } = await supabase
            .from("lesson_gen_queue")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending");

          return {
            preview: "Reset all failed jobs to pending status",
            executed: true,
            rows_affected: count ?? 0,
          };
        },

        // Clear stale queue jobs (older than 7 days)
        cleanup_queue: async () => {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { error } = await supabase
            .from("lesson_gen_queue")
            .delete()
            .lt("created_at", sevenDaysAgo);
          if (error) throw error;

          return {
            preview: "Delete queue jobs older than 7 days",
            executed: true,
            rows_affected: 0, // Supabase delete doesn't return count easily
          };
        },

        // Resync RAG embeddings (mark all as pending to re-embed)
        resync_rag: async () => {
          const { error } = await supabase
            .from("rag_chunks")
            .update({ embedding_status: "pending" })
            .neq("embedding_status", "pending");
          if (error) throw error;

          return {
            preview: "Reset all RAG chunks to pending for re-embedding",
            executed: true,
            rows_affected: 0,
          };
        },
      };

      const handler = handlers[action_type];
      if (!handler) {
        return res.status(400).json({
          error: `Unknown action_type: ${action_type}`,
          allowed: Object.keys(handlers),
        });
      }

      const result = await handler();
      return res.json({
        ok: true,
        task_id,
        action_type,
        preview: result.preview,
        executed: result.executed,
        rows_affected: result.rows_affected ?? 0,
      });
    } catch (err: any) {
      console.error(`[EXEC-TASK] ${action_type} failed:`, err);
      return res.status(500).json({
        error: `Execution failed: ${err.message}`,
        action_type,
      });
    }
  });

  // Scraping Agent Endpoint
  apiRouter.get("/scrape", async (req, res) => {
    console.log("Incoming request to /api/scrape");
    try {
      const url = "https://digischool.ma/";
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });
      const $ = cheerio.load(response.data);
      const newsItems: string[] = [];
      $('h1, h2, h3, h4, a').each((i, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 10 && i < 30) newsItems.push(text);
      });
      res.json({ newsItems });
    } catch (error) {
      console.error("Scraping Agent Error:", error);
      res.status(500).json({ error: "Failed to scrape data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Catch-all for API routes to ensure they always return JSON
  apiRouter.all("*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Mount API Router
  app.use("/api", apiRouter);

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global Error Handler:", err);
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ error: "Internal Server Error", message: err.message });
    }
    next(err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
