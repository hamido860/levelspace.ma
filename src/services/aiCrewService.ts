import { generateFullLesson, auditCurriculumConfig, generateSyllabus, auditClassroomContent } from "./geminiService";
import { db } from "../db/db";
import { toast } from "sonner";

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface AITask {
  id: string;
  type: "lesson_generation" | "curriculum_audit" | "syllabus_generation" | "classroom_audit";
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
