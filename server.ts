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
  // SECURITY: Do not use SERVICE_ROLE_KEY for the public proxy to prevent RLS bypass.
  // Use the ANON_KEY so that requests respect Row Level Security.
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
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
      // SECURITY: Do not leak internal error details to the client
      res.status(500).json({ error: "Failed to scrape data" });
    }
  });

  // Catch-all for API routes to ensure they always return JSON
  apiRouter.all("*", (req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  // Mount API Router
  app.use("/api", apiRouter);

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global Error Handler:", err);
    if (req.path.startsWith('/api/')) {
      // SECURITY: Do not leak error messages to the client
      return res.status(500).json({ error: "Internal Server Error" });
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
