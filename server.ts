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
          model: "meta/llama-3.3-70b-instruct",
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
      return res.json({ ok: true, result: parsed, model: "meta/llama-3.3-70b-instruct" });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err.message;
      console.error("[AI Analyst] NVIDIA API error:", msg);
      return res.status(502).json({ error: `NVIDIA API error: ${msg}` });
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
