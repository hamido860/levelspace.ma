import {
  generateFullLesson,
  auditCurriculumConfig,
  generateSyllabus,
  auditClassroomContent,
  generateQuizzesForLesson,
  generateExercisesForLesson,
  investigateAndPlan,
  generateLessonFromPlan,
  GenerationPlan,
} from "./geminiService";
import { supabase } from "../db/supabase";
import { db } from "../db/db";
import { searchLessons, searchContextForGeneration, saveLesson } from "./ragService";
import { mcpClient } from "./mcpClient";
import { toast } from "sonner";

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export type TaskType =
  | "lesson_generation"
  | "lesson_demand"         // triggered by a user fetch-miss — Pro plans, Gemma 4 executes
  | "curriculum_audit"
  | "syllabus_generation"
  | "classroom_audit"
  | "quiz_generation"
  | "exercise_generation";

export interface AITask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  payload: any;
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

// A record of a lesson the user tried to access but was not found
export interface LessonMiss {
  title: string;
  grade: string;
  subject: string;
  country: string;
  moduleId: string;
  userId: string;
  timestamp: number;
  taskId?: string;  // set once queued
}

const MISS_LOG_KEY = "lesson_miss_log";
const TASK_DELAY_MS = 1500;

class AICrewService {
  private tasks: AITask[] = [];
  private isProcessing = false;

  constructor() {
    this.loadTasks();
  }

  private loadTasks() {
    try {
      const saved = localStorage.getItem("ai_crew_tasks");
      if (saved) this.tasks = JSON.parse(saved);
    } catch { this.tasks = []; }
  }

  private saveTasks() {
    localStorage.setItem("ai_crew_tasks", JSON.stringify(this.tasks));
    window.dispatchEvent(new CustomEvent("ai-crew-update", { detail: this.tasks }));
  }

  // ─── Miss Log ───────────────────────────────────────────────────────────────

  getMissLog(): LessonMiss[] {
    try { return JSON.parse(localStorage.getItem(MISS_LOG_KEY) || "[]"); }
    catch { return []; }
  }

  private saveMissLog(log: LessonMiss[]) {
    localStorage.setItem(MISS_LOG_KEY, JSON.stringify(log.slice(-100))); // keep last 100
  }

  /**
   * Called when a user tries to fetch a lesson that doesn't exist.
   * Deduplicates: if a task is already pending/running for this lesson, skips.
   * Returns the task ID (new or existing).
   */
  logLessonMiss(miss: Omit<LessonMiss, "timestamp" | "taskId">): string {
    const log = this.getMissLog();
    const key = `${miss.title}::${miss.grade}::${miss.subject}::${miss.country}`.toLowerCase();

    // Check if already queued (pending or running)
    const existing = this.tasks.find(
      t => t.type === "lesson_demand" &&
        ["pending", "running"].includes(t.status) &&
        `${t.payload.title}::${t.payload.grade}::${t.payload.subject}::${t.payload.country}`.toLowerCase() === key
    );
    if (existing) {
      console.log("[AICrew] Lesson demand already queued:", existing.id);
      return existing.id;
    }

    // Log the miss
    const missEntry: LessonMiss = { ...miss, timestamp: Date.now() };
    log.push(missEntry);
    this.saveMissLog(log);

    // Auto-queue the task
    const taskId = this._enqueue("lesson_demand", {
      title: miss.title,
      grade: miss.grade,
      subject: miss.subject,
      country: miss.country,
      moduleId: miss.moduleId,
      userId: miss.userId,
    });

    // Back-fill taskId in log
    missEntry.taskId = taskId;
    this.saveMissLog(this.getMissLog().map(m =>
      m.title === miss.title && m.grade === miss.grade && !m.taskId ? { ...m, taskId } : m
    ));

    toast.info("AI Crew: lesson queued", {
      description: `"${miss.title}" (${miss.grade} · ${miss.subject}) is being generated.`,
      duration: 4000,
    });

    return taskId;
  }

  // ─── Task Queue ─────────────────────────────────────────────────────────────

  private _enqueue(type: TaskType, payload: any): string {
    const id = crypto.randomUUID();
    this.tasks.push({ id, type, status: "pending", payload, createdAt: Date.now(), updatedAt: Date.now() });
    this.saveTasks();
    this.processQueue();
    return id;
  }

  async addTask(type: TaskType, payload: any): Promise<string> {
    return this._enqueue(type, payload);
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    while (true) {
      const task = this.tasks.find(t => t.status === "pending");
      if (!task) break;
      await this.runTask(task);
      await new Promise(r => setTimeout(r, TASK_DELAY_MS));
    }
    this.isProcessing = false;
  }

  // ─── Task Runners ───────────────────────────────────────────────────────────

  private async runTask(task: AITask) {
    task.status = "running";
    task.updatedAt = Date.now();
    this.saveTasks();

    try {
      let result: any;

      switch (task.type) {

        // ── Demand-driven: Pro plans → Gemma 4 generates ──────────────────────
        case "lesson_demand":
          result = await this.runLessonDemand(task);
          break;

        // ── Admin-initiated bulk generation ───────────────────────────────────
        case "lesson_generation":
          result = await generateFullLesson(
            task.payload.topic,
            task.payload.country,
            task.payload.grade,
            task.payload.subject,
            task.payload.moduleName,
            2,
            task.payload.referenceUrls,
            task.payload.existingContext,
            task.payload.isAdmin
          );
          break;

        case "curriculum_audit":
          result = await auditCurriculumConfig(
            task.payload.country,
            task.payload.grade,
            task.payload.section,
            task.payload.track,
            task.payload.subject,
            task.payload.referenceUrls
          );
          break;

        case "syllabus_generation":
          result = await generateSyllabus(
            task.payload.country,
            task.payload.grade,
            task.payload.subject,
            task.payload.referenceUrls
          );
          break;

        case "classroom_audit":
          result = await auditClassroomContent(
            task.payload.moduleName,
            task.payload.country,
            task.payload.grade,
            task.payload.subject,
            task.payload.existingLessons
          );
          break;

        case "quiz_generation": {
          const quizzes = await generateQuizzesForLesson(
            task.payload.lessonTitle,
            task.payload.lessonContent,
            task.payload.existingCount ?? 0,
            task.payload.targetCount ?? 5,
            task.payload.country,
            task.payload.grade
          );
          if (quizzes.length > 0 && task.payload.lessonId) {
            await supabase.from("quizzes").insert({
              lesson_id: task.payload.lessonId,
              user_id: null,
              title: `Quiz: ${task.payload.lessonTitle}`,
              description: `Test your knowledge on ${task.payload.lessonTitle}`,
              difficulty: "medium",
              questions: quizzes.map((q: any, i: number) => ({
                id: `q-${Date.now()}-${i}`,
                type: "multiple-choice",
                question: q.question,
                options: q.options,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation || "",
              })),
            });
          }
          result = { quizzesAdded: quizzes.length };
          break;
        }

        case "exercise_generation": {
          const exercises = await generateExercisesForLesson(
            task.payload.lessonTitle,
            task.payload.lessonContent,
            task.payload.existingCount ?? 0,
            task.payload.targetCount ?? 5,
            task.payload.country,
            task.payload.grade
          );
          if (exercises.length > 0 && task.payload.lessonId) {
            const rows = exercises.map((ex: any, i: number) => ({
              lesson_id: task.payload.lessonId,
              title: `Exercise ${(task.payload.existingCount ?? 0) + i + 1}: ${task.payload.lessonTitle}`,
              prompt: ex.question,
              solution: ex.solution,
              hints: ex.hint ? [ex.hint] : [],
              difficulty: "medium",
              type: "practice",
            }));
            await supabase.from("exercises").insert(rows);
          }
          result = { exercisesAdded: exercises.length };
          break;
        }
      }

      task.status = "completed";
      task.result = result;
      if (task.type !== "lesson_demand") {
        toast.success(`AI Crew: ${task.type} completed`);
      }
    } catch (error: any) {
      task.status = "failed";
      task.error = error.message || String(error);
      toast.error(`AI Crew: ${task.type} failed — ${task.error}`);
    }

    task.updatedAt = Date.now();
    this.saveTasks();
  }

  /**
   * 3-stage pipeline for demand-driven lesson generation:
   * 1. Gemini Pro investigates RAG + curriculum → GenerationPlan
   * 2. NVIDIA Gemma 4 executes the plan → LessonTemplate
   * 3. MCP validates → save to Supabase + dispatch lesson-ready
   */
  private async runLessonDemand(task: AITask): Promise<any> {
    const { title, grade, subject, country, moduleId, userId } = task.payload;

    toast.info(`AI Crew: investigating "${title}"`, {
      description: "Pro model is analyzing curriculum + RAG...",
      duration: 4000,
    });

    // ── Stage 1: Pro investigates ─────────────────────────────────────────────
    const [similarLessons, ragContext] = await Promise.all([
      searchLessons(`${grade} ${subject} ${title}`, 3),
      searchContextForGeneration(userId || "system", `${subject} ${title} ${grade}`),
    ]);

    // If RAG already has a very close match (someone else generated it between miss and now), use it
    if (similarLessons.length > 0 && (similarLessons[0].similarity || 0) >= 0.92) {
      const found = similarLessons[0];
      console.log("[AICrew/demand] Found in RAG after re-check, skipping generation");
      window.dispatchEvent(new CustomEvent("lesson-ready", {
        detail: { title, grade, subject, country, lessonId: found.id, source: "rag-hit" }
      }));
      return { source: "rag", lessonId: found.id };
    }

    const plan: GenerationPlan | null = await investigateAndPlan({
      title, grade, subject, country, moduleId,
      userId: userId || "system",
      ragContext,
      similarLessons,
    });

    if (!plan) {
      throw new Error("Pro model failed to produce a GenerationPlan");
    }

    console.log("[AICrew/demand] Plan ready:", plan.depth, "depth,", plan.bloom_level, "bloom,", plan.timeline.complexity, "complexity");
    toast.info(`AI Crew: generating "${title}"`, {
      description: `Gemma 4 is building the lesson (${plan.depth}, ${plan.timeline.complexity} complexity)...`,
      duration: 5000,
    });

    // ── Stage 2: Gemma 4 generates ────────────────────────────────────────────
    const lessonData = await generateLessonFromPlan(plan);
    if (!lessonData) {
      throw new Error("Worker (Gemma 4 / Flash) failed to generate lesson from plan");
    }

    // ── Stage 3: MCP validate + save ─────────────────────────────────────────
    const correction = mcpClient.validateAndGetCorrection(
      { title: lessonData.lesson_title, content: lessonData.content, exercises: lessonData.exercises, quizzes: lessonData.quizzes },
      country, grade, subject
    );
    if (correction) {
      // One retry with correction injected into plan
      const correctedPlan = { ...plan, worker_instruction: plan.worker_instruction + "\n\n" + correction };
      const retry = await generateLessonFromPlan(correctedPlan);
      if (retry) Object.assign(lessonData, retry);
    }

    const saved = await saveLesson(lessonData, userId, true);
    const lessonId = saved ? lessonData.id : undefined;

    // Notify the UI — LessonView listens for this event
    window.dispatchEvent(new CustomEvent("lesson-ready", {
      detail: { title, grade, subject, country, lessonId, source: "generated" }
    }));

    toast.success(`"${title}" is ready!`, {
      description: "AI Crew finished generating the lesson. Reloading...",
      duration: 5000,
    });

    return { lessonId, plan: { depth: plan.depth, bloom_level: plan.bloom_level, worker: "gemma4" } };
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  getTasks() { return this.tasks; }

  clearCompleted() {
    this.tasks = this.tasks.filter(t => t.status !== "completed" && t.status !== "failed");
    this.saveTasks();
  }

  clearAll() {
    this.tasks = [];
    this.saveTasks();
  }
}

export const aiCrew = new AICrewService();
