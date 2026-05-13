import { supabase } from "../db/supabase";
import { handleApiError, LessonTemplate } from "./geminiService";
import { resolveTopicForLesson } from "../../lib/topicSync";
import { deriveCycleFromGrade } from "./curriculumMatching";
import { isMissingLessonValidationColumnError, stripLessonValidationFields } from "./lessonSupabase";

export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const response = await fetch("/api/ai/embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || `Embedding request failed with status ${response.status}`);
    }

    return Array.isArray(data.embedding) ? data.embedding : [];
  } catch (error) {
    handleApiError(error, "generateEmbedding");
    return [];
  }
};

export const indexLessonContent = async (
  userId: string,
  lessonId: string,
  content: string,
) => {
  console.info(
    "Skipping lesson RAG indexing: generated lesson content belongs in lessons/lesson_blocks, not rag_chunks.",
    { userId, lessonId, contentLength: content.length }
  );
  return true;
};

export const retrieveSimilarContent = async (
  userId: string,
  query: string,
  matchCount: number = 3,
) => {
  try {
    const queryEmbedding = await generateEmbedding(query);
    if (queryEmbedding.length === 0) return [];

    const { data, error } = await supabase.rpc("match_rag_embeddings", {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: matchCount,
    });

    if (error) {
      const legacy = await supabase.rpc("match_rag_chunks", {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: matchCount,
        p_user_id: userId,
      });
      if (legacy.error) throw error;
      return legacy.data || [];
    }
    return data || [];
  } catch (error) {
    console.error("Error retrieving similar content:", error);
    return [];
  }
};

export const searchContextForGeneration = async (
  userId: string,
  query: string,
) => {
  const similarContent = await retrieveSimilarContent(userId, query);
  if (similarContent.length === 0) return "";

  return similarContent.map((item: any) => item.content).join("\n\n");
};

export const searchLessons = async (
  query: string,
  matchCount: number = 3,
): Promise<LessonTemplate[]> => {
  try {
    const safeQuery = query.trim();
    if (!safeQuery) return [];

    const { data, error } = await supabase
      .from("lessons")
      .select("*")
      .or(`lesson_title.ilike.%${safeQuery}%,title.ilike.%${safeQuery}%,subject.ilike.%${safeQuery}%,content.ilike.%${safeQuery}%`)
      .limit(matchCount);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error searching lessons:", error);
    return [];
  }
};

export const deleteLessonsByScope = async (
  country: string,
  grade: string,
  subject: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("lessons")
      .delete()
      .eq("country", country)
      .eq("grade", grade)
      .eq("subject", subject);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting lessons by scope:", error);
    return false;
  }
};

export const deleteLessonById = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting lesson by id:", error);
    return false;
  }
};

export const updateLesson = async (
  id: string,
  updates: Partial<LessonTemplate>
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("lessons")
      .update(updates)
      .eq("id", id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error updating lesson:", error);
    return false;
  }
};

export const saveLesson = async (
  lesson: LessonTemplate,
  userId?: string,
  isAiGenerated: boolean = false
): Promise<boolean> => {
  try {
    const topicResolution = await resolveTopicForLesson(
      supabase as any,
      {
        grade: lesson.grade,
        subject: lesson.subject,
        lesson_title: lesson.lesson_title,
      },
      { createIfMissing: true }
    );

    const topicId = topicResolution.status === "skipped" ? null : topicResolution.topicId;
    const cycle = deriveCycleFromGrade(lesson.grade);

    // 1. Insert the lesson and get its ID
    const lessonInsertPayload = {
      country: lesson.country,
      cycle,
      grade: lesson.grade,
      subject: lesson.subject,
      topic_id: topicId,
      lesson_title: lesson.lesson_title,
      content: lesson.content,
      blocks: lesson.blocks && lesson.blocks.length > 0 ? lesson.blocks : null, // NEW
      exercises: lesson.exercises || [],
      quizzes: lesson.quizzes || [],
      mod: lesson.mod,
      exam: lesson.exam || null,
      embedding: null,
      author_id: userId === "dummy-user-id" ? null : (userId || null),
      is_ai_generated: isAiGenerated,
      validation_status: isAiGenerated ? 'ai_generated' : 'unverified',
      source_confidence: 0,
      source_mode: isAiGenerated ? 'ai_generated' : 'manual',
      status: isAiGenerated ? 'review' : 'draft',
    };

    let insertedLesson: { id: string } | null = null;
    let lessonError: any = null;

    const firstInsert = await supabase.from("lessons").insert(lessonInsertPayload).select('id').single();
    insertedLesson = firstInsert.data;
    lessonError = firstInsert.error;

    if (lessonError && isMissingLessonValidationColumnError(lessonError)) {
      const legacyInsert = await supabase
        .from("lessons")
        .insert(stripLessonValidationFields(lessonInsertPayload))
        .select('id')
        .single();

      insertedLesson = legacyInsert.data;
      lessonError = legacyInsert.error;
    }

    if (lessonError) throw lessonError;
    
    const lessonId = insertedLesson.id;
    const actualUserId = userId === "dummy-user-id" ? null : (userId || null);

    // 2. Insert Quizzes
    if (lesson.quizzes && lesson.quizzes.length > 0) {
      const quizQuestions = lesson.quizzes.map((q: any, index: number) => ({
        id: `q-${index}`,
        type: 'multiple-choice',
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation
      }));

      const { error: quizError } = await supabase.from("quizzes").insert({
        lesson_id: lessonId,
        user_id: actualUserId,
        title: `Quiz: ${lesson.lesson_title}`,
        description: `Test your knowledge on ${lesson.lesson_title}`,
        difficulty: 'medium',
        questions: quizQuestions
      });
      
      if (quizError) console.error("Error saving quizzes:", quizError);
    }

    // 3. Insert Exercises
    if (lesson.exercises && lesson.exercises.length > 0) {
      const exerciseInserts = lesson.exercises.map((ex: any, index: number) => ({
        lesson_id: lessonId,
        title: `Exercise ${index + 1}: ${lesson.lesson_title}`,
        prompt: ex.question,
        solution: ex.solution,
        difficulty: 'medium',
        type: 'practice',
        hints: []
      }));

      const { error: exerciseError } = await supabase.from("exercises").insert(exerciseInserts);
      
      if (exerciseError) console.error("Error saving exercises:", exerciseError);
    }

    return true;
  } catch (error) {
    console.error("Error saving lesson:", error);
    return false;
  }
};
