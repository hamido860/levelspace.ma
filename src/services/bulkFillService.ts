import { supabase } from "../db/supabase";
import { searchLessons, saveLesson } from "./ragService";
import {
  generateFullLesson,
  generateQuizzesForLesson,
  generateExercisesForLesson,
  MAX_QUIZZES_PER_LESSON,
  MAX_EXERCISES_PER_LESSON,
} from "./geminiService";

const TASK_DELAY_MS = 1800; // rate-limit between AI calls
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface BulkFillProgress {
  current: number;
  total: number;
  currentTopic: string;
  lessonsGenerated: number;
  quizzesAdded: number;
  exercisesAdded: number;
  skipped: number;
  errors: string[];
  done: boolean;
}

export type BulkFillProgressCallback = (p: BulkFillProgress) => void;

async function getQuizCount(lessonId: string): Promise<number> {
  const { data } = await supabase
    .from("quizzes")
    .select("id", { count: "exact", head: true })
    .eq("lesson_id", lessonId);
  return (data as any)?.length ?? 0;
}

async function getExerciseCount(lessonId: string): Promise<number> {
  const { data } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("lesson_id", lessonId);
  return (data as any)?.length ?? 0;
}

async function saveQuizzes(
  lessonId: string,
  lessonTitle: string,
  quizzes: any[]
): Promise<number> {
  if (!quizzes.length) return 0;
  const { error } = await supabase.from("quizzes").insert({
    lesson_id: lessonId,
    user_id: null,
    title: `Quiz: ${lessonTitle}`,
    description: `Test your knowledge on ${lessonTitle}`,
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
  if (error) throw new Error(`Quiz save error: ${error.message}`);
  return quizzes.length;
}

async function saveExercises(
  lessonId: string,
  lessonTitle: string,
  exercises: any[],
  offset: number
): Promise<number> {
  if (!exercises.length) return 0;
  const rows = exercises.map((ex: any, i: number) => ({
    lesson_id: lessonId,
    title: `Exercise ${offset + i + 1}: ${lessonTitle}`,
    prompt: ex.question,
    solution: ex.solution,
    hints: ex.hint ? [ex.hint] : [],
    difficulty: "medium",
    type: "practice",
  }));
  const { error } = await supabase.from("exercises").insert(rows);
  if (error) throw new Error(`Exercise save error: ${error.message}`);
  return exercises.length;
}

export const bulkFillService = {
  async run(
    topics: string[],
    country: string,
    grade: string,
    subject: string,
    moduleName: string,
    userId: string,
    onProgress: BulkFillProgressCallback
  ) {
    const progress: BulkFillProgress = {
      current: 0,
      total: topics.length,
      currentTopic: "",
      lessonsGenerated: 0,
      quizzesAdded: 0,
      exercisesAdded: 0,
      skipped: 0,
      errors: [],
      done: false,
    };

    for (const topic of topics) {
      progress.current++;
      progress.currentTopic = topic;
      onProgress({ ...progress });

      try {
        // 1. Check RAG for existing lesson (similarity >= 0.85)
        let lessonId: string | null = null;
        let lessonContent = "";
        let lessonTitle = topic;

        const similar = await searchLessons(topic, 1);
        const bestMatch = similar[0];

        if (bestMatch && (bestMatch.similarity ?? 0) >= 0.85) {
          lessonId = bestMatch.id ?? null;
          lessonContent = bestMatch.content ?? "";
          lessonTitle = bestMatch.lesson_title ?? topic;
          progress.skipped++;
        } else {
          // 2. Generate full lesson (includes 2-3 quizzes + exercises internally)
          const lesson = await generateFullLesson(
            topic,
            country,
            grade,
            subject,
            moduleName,
            2,
            [],
            "",
            true
          );

          if (!lesson) {
            progress.errors.push(`Generation failed: ${topic}`);
            onProgress({ ...progress });
            await sleep(TASK_DELAY_MS);
            continue;
          }

          await saveLesson(lesson, userId, true);
          progress.lessonsGenerated++;
          lessonContent = lesson.content;
          lessonTitle = lesson.lesson_title;

          // Re-fetch to get the stored ID
          await sleep(500);
          const fresh = await searchLessons(topic, 1);
          if (fresh[0]?.id) lessonId = fresh[0].id;
        }

        if (!lessonId) {
          progress.errors.push(`No lesson ID after save: ${topic}`);
          onProgress({ ...progress });
          await sleep(TASK_DELAY_MS);
          continue;
        }

        await sleep(TASK_DELAY_MS);

        // 3. Top up quizzes to MAX_QUIZZES_PER_LESSON
        const currentQuizCount = await getQuizCount(lessonId);
        if (currentQuizCount < MAX_QUIZZES_PER_LESSON) {
          const newQuizzes = await generateQuizzesForLesson(
            lessonTitle,
            lessonContent,
            currentQuizCount,
            MAX_QUIZZES_PER_LESSON,
            country,
            grade
          );
          const saved = await saveQuizzes(lessonId, lessonTitle, newQuizzes);
          progress.quizzesAdded += saved;
        }

        await sleep(TASK_DELAY_MS);

        // 4. Top up exercises to MAX_EXERCISES_PER_LESSON
        const currentExerciseCount = await getExerciseCount(lessonId);
        if (currentExerciseCount < MAX_EXERCISES_PER_LESSON) {
          const newExercises = await generateExercisesForLesson(
            lessonTitle,
            lessonContent,
            currentExerciseCount,
            MAX_EXERCISES_PER_LESSON,
            country,
            grade
          );
          const saved = await saveExercises(
            lessonId,
            lessonTitle,
            newExercises,
            currentExerciseCount
          );
          progress.exercisesAdded += saved;
        }
      } catch (err: any) {
        progress.errors.push(`${topic}: ${err.message}`);
      }

      onProgress({ ...progress });
      await sleep(TASK_DELAY_MS);
    }

    progress.done = true;
    onProgress({ ...progress });
  },
};
