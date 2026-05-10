import express, { type NextFunction, type Request, type Response } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

type ApiHandlerModule = {
  default: (req: Request, res: Response) => unknown | Promise<unknown>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.API_PORT || process.env.PORT || 4321);

const apiRouteTable = [
  ["/api/ai-analyst", "./api/ai-analyst.ts"],
  ["/api/ai-approve-task", "./api/ai-approve-task.ts"],
  ["/api/ai-execute-task", "./api/ai-execute-task.ts"],
  ["/api/ai-plan-task", "./api/ai-plan-task.ts"],
  ["/api/ai-rag-check", "./api/ai-rag-check.ts"],
  ["/api/ai-reject-task", "./api/ai-reject-task.ts"],
  ["/api/ai-request-approval", "./api/ai-request-approval.ts"],
  ["/api/ai-run-audit", "./api/ai-run-audit.ts"],
  ["/api/ai-run-monitoring", "./api/ai-run-monitoring.ts"],
  ["/api/ai-validate-task", "./api/ai-validate-task.ts"],
  ["/api/admin/ai-recovery/failed-jobs", "./api/admin/ai-recovery/failed-jobs.ts"],
  ["/api/admin/ai-recovery/logs", "./api/admin/ai-recovery/logs.ts"],
  ["/api/admin/ai-recovery/recovered-lessons", "./api/admin/ai-recovery/recovered-lessons.ts"],
  ["/api/admin/ai-recovery/jobs/:jobId/create-task", "./api/admin/ai-recovery/jobs/[jobId]/create-task.ts"],
  ["/api/admin/ai-recovery/jobs/:jobId/diagnostics", "./api/admin/ai-recovery/jobs/[jobId]/diagnostics.ts"],
  ["/api/admin/ai-recovery/recovered-lessons/:lessonId/approve", "./api/admin/ai-recovery/recovered-lessons/[lessonId]/approve.ts"],
  ["/api/admin/ai-recovery/recovered-lessons/:lessonId/detail", "./api/admin/ai-recovery/recovered-lessons/[lessonId]/detail.ts"],
  ["/api/admin/ai-recovery/recovered-lessons/:lessonId/reject", "./api/admin/ai-recovery/recovered-lessons/[lessonId]/reject.ts"],
  ["/api/admin/ai-recovery/recovered-lessons/:lessonId/save", "./api/admin/ai-recovery/recovered-lessons/[lessonId]/save.ts"],
  ["/api/admin/ai-recovery/recovered-lessons/:lessonId/send-back", "./api/admin/ai-recovery/recovered-lessons/[lessonId]/send-back.ts"],
  ["/api/admin/ai-recovery/tasks/:taskId/approve-execute", "./api/admin/ai-recovery/tasks/[taskId]/approve-execute.ts"],
  ["/api/admin/ai-recovery/tasks/:taskId/copy-sql", "./api/admin/ai-recovery/tasks/[taskId]/copy-sql.ts"],
  ["/api/admin/ai-recovery/tasks/:taskId/detail", "./api/admin/ai-recovery/tasks/[taskId]/detail.ts"],
  ["/api/admin/ai-recovery/tasks/:taskId/execute", "./api/admin/ai-recovery/tasks/[taskId]/execute.ts"],
  ["/api/admin/ai-recovery/tasks/:taskId/generate-sql", "./api/admin/ai-recovery/tasks/[taskId]/generate-sql.ts"],
  ["/api/admin/ai-recovery/tasks/:taskId/reject-sql", "./api/admin/ai-recovery/tasks/[taskId]/reject-sql.ts"],
  ["/api/admin/ai-recovery/tasks/:taskId/reset", "./api/admin/ai-recovery/tasks/[taskId]/reset.ts"],
  ["/api/admin/ai-recovery/tasks/:taskId/safety-check", "./api/admin/ai-recovery/tasks/[taskId]/safety-check.ts"],
  ["/api/admin/lessons/seed-starter", "./api/admin/lessons/seed-starter.ts"],
  ["/api/admin/topics/repair", "./api/admin/topics/repair.ts"],
] as const;

const handlerCache = new Map<string, Promise<ApiHandlerModule["default"]>>();

const loadHandler = (modulePath: string) => {
  const existing = handlerCache.get(modulePath);
  if (existing) {
    return existing;
  }

  const promise = import(new URL(modulePath, import.meta.url).href).then((mod) => {
    const handler = (mod as ApiHandlerModule).default;
    if (typeof handler !== "function") {
      throw new Error(`API module ${modulePath} does not export a default handler.`);
    }
    return handler;
  });

  handlerCache.set(modulePath, promise);
  return promise;
};

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

for (const [routePath, modulePath] of apiRouteTable) {
  app.all(routePath, async (req, res, next) => {
    try {
      Object.assign(req.query, req.params);
      const handler = await loadHandler(modulePath);
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  });
}

const start = async () => {
  const vite = await createViteServer({
    root: __dirname,
    server: {
      middlewareMode: true,
    },
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    try {
      const url = req.originalUrl;
      const templatePath = path.resolve(__dirname, "index.html");
      const template = await readFile(templatePath, "utf-8");
      const html = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "Unknown server error";
    console.error("[dev-server]", error);
    if (res.headersSent) {
      return;
    }
    res.status(500).json({ error: message });
  });

  app.listen(port, () => {
    console.log(`Levelspace dev server running at http://localhost:${port}`);
  });
};

start().catch((error) => {
  console.error("[dev-server] failed to start", error);
  process.exit(1);
});
