import { generateFullLesson, auditCurriculumConfig, generateSyllabus, auditClassroomContent, generateQuizzesForLesson, generateExercisesForLesson } from "./geminiService";
import { supabase } from "../db/supabase";
import { db } from "../db/db";
import { toast } from "sonner";

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface AITask {
  id: string;
  type: "lesson_generation" | "curriculum_audit" | "syllabus_generation" | "classroom_audit" | "quiz_generation" | "exercise_generation";
  status: TaskStatus;
  payload: any;
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

class AICrewService {
  private tasks: AITask[] = [];
  private isProcessing = false;

  constructor() {
    this.loadTasks();
  }

  private async loadTasks() {
    // In a real app, we might load from IndexedDB
    const savedTasks = localStorage.getItem("ai_crew_tasks");
    if (savedTasks) {
      this.tasks = JSON.parse(savedTasks);
    }
  }

  private saveTasks() {
    localStorage.setItem("ai_crew_tasks", JSON.stringify(this.tasks));
    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent("ai-crew-update", { detail: this.tasks }));
  }

  async addTask(type: AITask["type"], payload: any): Promise<string> {
    const id = crypto.randomUUID();
    const task: AITask = {
      id,
      type,
      status: "pending",
      payload,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.tasks.push(task);
    this.saveTasks();
    this.processQueue();
    return id;
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (true) {
      const task = this.tasks.find((t) => t.status === "pending");
      if (!task) break;

      await this.runTask(task);
      // Rate limit between tasks to avoid quota exhaustion
      await new Promise((r) => setTimeout(r, 1500));
    }

    this.isProcessing = false;
  }

  private async runTask(task: AITask) {
    task.status = "running";
    task.updatedAt = Date.now();
    this.saveTasks();

    try {
      let result;
      switch (task.type) {
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
      toast.success(`AI Crew: Task ${task.type} completed!`);
    } catch (error: any) {
      task.status = "failed";
      task.error = error.message || String(error);
      toast.error(`AI Crew: Task ${task.type} failed: ${task.error}`);
    }

    task.updatedAt = Date.now();
    this.saveTasks();
  }

  getTasks() {
    return this.tasks;
  }

  clearCompleted() {
    this.tasks = this.tasks.filter((t) => t.status !== "completed" && t.status !== "failed");
    this.saveTasks();
  }

  clearAll() {
    this.tasks = [];
    this.saveTasks();
  }
}

export const aiCrew = new AICrewService();
