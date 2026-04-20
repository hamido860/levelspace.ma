import { supabase } from "../db/supabase";
import { generateFullLesson, LessonTemplate, AILesson, AILessonBlock } from "./geminiService";
import { saveLesson, searchLessons } from "./ragService";

export const lessonService = {
  /**
   * Fetches a lesson from the database or generates it using AI if not found.
   */
  fetchOrGenerate: async (
    params: {
      title: string;
      grade: string;
      country: string;
      moduleId: string;
    },
    userId: string
  ): Promise<(AILesson & { id?: string }) | null> => {
    const { title, grade, country, moduleId } = params;

    try {
      // 1. Search for existing lesson in Supabase using RAG/Vector search
      console.log(`Searching for existing lesson: ${title}`);
      const similarLessons = await searchLessons(title, 1);
      
      let lessonData: LessonTemplate | null = null;

      // If we found a very similar lesson (similarity > 0.9), use it
      if (similarLessons.length > 0 && (similarLessons[0].similarity || 0) > 0.9) {
        console.log("Found existing lesson in Supabase via RAG");
        lessonData = similarLessons[0];
      } else {
        // 2. If not found, generate using AI
        console.log("Lesson not found in Supabase. Generating with AI...");
        
        const { data: moduleData } = await supabase
          .from('modules')
          .select('name')
          .eq('id', moduleId)
          .maybeSingle();
        
        const subject = moduleData?.name || "General";

        lessonData = await generateFullLesson(
          title,
          country,
          grade,
          subject,
          subject
        );

        if (lessonData) {
          // 3. Save to Supabase for future RAG use
          await saveLesson(lessonData, userId, true);
        }
      }

      if (lessonData) {
        // Transform LessonTemplate to AILesson format for the UI
        const blocks: AILessonBlock[] = [
          {
            type: 'content',
            title: 'Lesson Content',
            content: lessonData.content
          }
        ];

        if (lessonData.exercises && lessonData.exercises.length > 0) {
          blocks.push({
            type: 'examples',
            title: 'Exercises',
            examples: lessonData.exercises.map((ex: any) => ({
              question: ex.question,
              steps: [],
              answer: ex.solution
            }))
          });
        }

        if (lessonData.quizzes && lessonData.quizzes.length > 0) {
          lessonData.quizzes.forEach((q: any) => {
            blocks.push({
              type: 'quiz',
              title: 'Quiz',
              quiz: {
                question: q.question,
                options: q.options,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation
              }
            });
          });
        }

        if (lessonData.exam) {
          blocks.push({
            type: 'exam',
            title: 'Exam Question',
            exam: {
              source: 'National Exam Style',
              question: lessonData.exam.question,
              hint: lessonData.exam.hint || '',
              solution: lessonData.exam.solution
            }
          });
        }

        return {
          id: lessonData.id,
          title: lessonData.lesson_title,
          subtitle: `${blocks.length} sections · ~15 min`,
          blocks
        };
      }

      return null;
    } catch (error) {
      console.error("Error in lessonService.fetchOrGenerate:", error);
      return null;
    }
  }
};
