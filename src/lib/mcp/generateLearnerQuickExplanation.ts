import { supabase } from "../../db/supabase";
import { buildMcpLessonPrompt, McpLearnerContext } from "./buildMcpLessonPrompt";
import { loadMcpContext } from "./loadMcpContext";

export interface LearnerQuickExplanation {
  mode: "learner_quick_explanation";
  topic: string;
  explanation: string;
  simple_example: string;
  common_mistake: string;
  check_question: string;
  answer: string;
  confidence: number;
  based_on: "verified_lesson" | "topic_outline" | "rag_chunk";
}

const fallbackExplanation = (
  topic: string,
  basis: "verified_lesson" | "topic_outline" | "rag_chunk",
  text: string,
): LearnerQuickExplanation => ({
  mode: "learner_quick_explanation",
  topic,
  explanation: text || `This is a quick, non-official explanation for ${topic}. Review the verified lesson when it becomes available.`,
  simple_example: "Try to connect the idea to one simple classroom example before moving to exercises.",
  common_mistake: "A common mistake is memorizing words without checking what they mean in this topic.",
  check_question: `In one sentence, what is the main idea of ${topic}?`,
  answer: "The answer should name the core idea and one supporting detail from the lesson.",
  confidence: basis === "verified_lesson" ? 0.9 : basis === "rag_chunk" ? 0.72 : 0.55,
  based_on: basis,
});

export const generateLearnerQuickExplanation = async (
  topicId: string,
  learnerContext?: McpLearnerContext,
): Promise<LearnerQuickExplanation> => {
  const { data: verifiedLessons, error: lessonError } = await supabase
    .from("lessons")
    .select("lesson_title, content, blocks, validation_status, source_confidence")
    .eq("topic_id", topicId)
    .in("validation_status", ["teacher_reviewed", "official_validated", "published", "verified"])
    .order("updated_at", { ascending: false })
    .limit(1);

  if (!lessonError && Array.isArray(verifiedLessons) && verifiedLessons[0]) {
    const lesson = verifiedLessons[0] as any;
    const sourceText = String(lesson.content || lesson.lesson_title || "").slice(0, 700);
    return fallbackExplanation(String(lesson.lesson_title || "Verified lesson"), "verified_lesson", sourceText);
  }

  const context = await loadMcpContext(topicId, "learner_light");
  const firstOutline = context.topicOutlines[0];
  if (firstOutline) {
    return fallbackExplanation(
      context.topic.title,
      "topic_outline",
      [firstOutline.title, firstOutline.description].filter(Boolean).join(": "),
    );
  }

  const firstChunk = context.ragChunks[0];
  if (firstChunk) {
    return fallbackExplanation(context.topic.title, "rag_chunk", String(firstChunk.content || "").slice(0, 700));
  }

  // Keep the prompt available for future model execution without saving learner output as an official lesson.
  buildMcpLessonPrompt({
    pipelineType: "learner_light",
    topic: context.topic,
    topicOutlines: context.topicOutlines,
    trustedSources: context.trustedSources,
    materialRequirements: context.materialRequirements,
    learnerContext,
  });

  return fallbackExplanation(context.topic.title, "topic_outline", "");
};
