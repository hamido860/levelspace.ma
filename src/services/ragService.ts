import { supabase } from "../db/supabase";
import { ai, handleApiError, LessonTemplate } from "./geminiService";

export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: text,
    });

    if (
      response.embeddings &&
      response.embeddings.length > 0 &&
      response.embeddings[0].values
    ) {
      return response.embeddings[0].values;
    }
    throw new Error("No embedding returned");
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
  try {
    // Split content into chunks (simple chunking by paragraphs for now)
    const chunks = content.split("\n\n").filter((c) => c.trim().length > 50);

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk);
      if (embedding.length > 0) {
        await supabase.from("rag_chunks").insert({
          source_id: lessonId,
          source_type: 'lesson_block',
          content: chunk,
          embedding: embedding,
          metadata: { user_id: userId }
        });
      }
    }
    return true;
  } catch (error) {
    console.error("Error indexing lesson content:", error);
    return false;
  }
};

export const retrieveSimilarContent = async (
  userId: string,
  query: string,
  matchCount: number = 3,
) => {
  try {
    const queryEmbedding = await generateEmbedding(query);
    if (queryEmbedding.length === 0) return [];

    const { data, error } = await supabase.rpc("match_rag_chunks", {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: matchCount,
      p_user_id: userId,
    });

    if (error) throw error;
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
    const queryEmbedding = await generateEmbedding(query);
    if (queryEmbedding.length === 0) return [];

    const { data, error } = await supabase.rpc("match_lessons", {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: matchCount,
    });

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
    // If content or title changed, we should ideally re-generate the embedding
    let embedding = undefined;
    if (updates.content || updates.lesson_title || updates.subject) {
      const textToEmbed = `${updates.lesson_title || ""}\n${updates.subject || ""}\n${updates.content || ""}`;
      embedding = await generateEmbedding(textToEmbed);
    }

    const { error } = await supabase
      .from("lessons")
      .update({
        ...updates,
        ...(embedding && embedding.length > 0 ? { embedding } : {}),
      })
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
    // Generate embedding based on the core content of the lesson
    const textToEmbed = `${lesson.lesson_title}\n${lesson.subject}\n${lesson.content}`;
    const embedding = await generateEmbedding(textToEmbed);

    if (embedding.length === 0) return false;

    // 1. Insert the lesson and get its ID
    const { data: insertedLesson, error: lessonError } = await supabase.from("lessons").insert({
      country: lesson.country,
      grade: lesson.grade,
      subject: lesson.subject,
      lesson_title: lesson.lesson_title,
      content: lesson.content,
      blocks: lesson.blocks && lesson.blocks.length > 0 ? lesson.blocks : null, // NEW
      exercises: lesson.exercises || [],
      quizzes: lesson.quizzes || [],
      mod: lesson.mod,
      exam: lesson.exam || null,
      embedding: embedding.length > 0 ? embedding : null,
      author_id: userId === "dummy-user-id" ? null : (userId || null),
      is_ai_generated: isAiGenerated,
    }).select('id').single();

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
