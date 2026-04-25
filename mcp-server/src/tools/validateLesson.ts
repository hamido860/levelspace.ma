import { checkLanguage } from "./checkLanguage.js";
import { PEDAGOGY_RULES, getMinimumBloomLevel } from "../data/pedagogy.js";

export interface LessonToValidate {
  title: string;
  content: string;
  blocks?: Array<{ type: string; content?: string; rules?: string[]; examples?: any[]; quiz?: any }>;
  exercises?: Array<{ question: string; solution: string }>;
  quizzes?: Array<{ question: string; options: string[]; correctAnswer: string }>;
}

export interface ValidateLessonInput {
  lesson: LessonToValidate;
  country: string;
  grade: string;
  subject: string;
}

export interface ValidateLessonResult {
  valid: boolean;
  score: number; // 0–100
  languageCheck: ReturnType<typeof checkLanguage>;
  structureViolations: string[];
  pedagogyViolations: string[];
  allViolations: string[];
  correctionPrompt: string; // Injected into regeneration prompt
}

export function validateLesson(input: ValidateLessonInput): ValidateLessonResult {
  const { lesson, country, grade, subject } = input;

  const structureViolations: string[] = [];
  const pedagogyViolations: string[] = [];

  // 1. Language check on all text content
  const allContent = [
    lesson.title,
    lesson.content,
    ...(lesson.blocks?.map(b => [b.content || "", ...(b.rules || [])].join(" ")) || []),
    ...(lesson.exercises?.map(e => e.question + " " + e.solution) || []),
    ...(lesson.quizzes?.map(q => q.question + " " + q.options.join(" ")) || []),
  ].join("\n\n");

  const langCheck = checkLanguage({ content: allContent, country, subject });

  // 2. Structure checks
  const schema = PEDAGOGY_RULES.structureSchema;

  if (lesson.blocks && lesson.blocks.length < schema.minBlocks) {
    structureViolations.push(
      `Too few blocks: ${lesson.blocks.length} found, minimum ${schema.minBlocks} required.`
    );
  }

  const hasDefinitionOrContent = lesson.blocks?.some(
    b => b.type === "definition" || b.type === "content"
  );
  if (!hasDefinitionOrContent) {
    structureViolations.push("Missing required definition or content block.");
  }

  const hasExamples = lesson.blocks?.some(b => b.type === "examples") ||
    (lesson.exercises && lesson.exercises.length > 0);
  if (!hasExamples) {
    structureViolations.push("Missing examples or exercises block.");
  }

  // Check quiz options count
  lesson.quizzes?.forEach((q, i) => {
    if (!q.options || q.options.length < schema.quizMinOptions) {
      structureViolations.push(
        `Quiz ${i + 1}: only ${q.options?.length || 0} options, minimum ${schema.quizMinOptions} required.`
      );
    }
  });

  // 3. Pedagogy checks
  const minBloom = getMinimumBloomLevel(grade);
  const bloomLevel = PEDAGOGY_RULES.bloomsTaxonomy.levels.find(l => l.level === minBloom);

  // Check for wall-of-text paragraphs in content
  const paragraphs = lesson.content?.split("\n\n") || [];
  const longParagraphs = paragraphs.filter(p => {
    const sentences = p.split(/[.!?]/).filter(s => s.trim().length > 10);
    return sentences.length > 4;
  });
  if (longParagraphs.length > 0) {
    pedagogyViolations.push(
      `${longParagraphs.length} paragraph(s) exceed 4 sentences — break them into bullet points.`
    );
  }

  // Check for raw math (not LaTeX)
  const rawMathPatterns = [/lim\s+x\s*->/i, /x\s*\^\s*2(?!\$)/, /sqrt\s*\(/i];
  const hasRawMath = rawMathPatterns.some(p => p.test(lesson.content || ""));
  if (hasRawMath) {
    pedagogyViolations.push("Raw math expressions detected — all math must use LaTeX ($...$).");
  }

  // Check exercises have solutions
  lesson.exercises?.forEach((ex, i) => {
    if (!ex.solution || ex.solution.trim().length < 20) {
      pedagogyViolations.push(`Exercise ${i + 1} has no proper solution (too short).`);
    }
  });

  const allViolations = [
    ...langCheck.violations,
    ...structureViolations,
    ...pedagogyViolations,
  ];

  const score = Math.max(0, 100 - allViolations.length * 15);
  const valid = allViolations.length === 0;

  // Build correction prompt
  let correctionPrompt = "";
  if (!valid) {
    correctionPrompt = `\n\n=== VALIDATION FAILED — CORRECTION REQUIRED ===\n`;
    correctionPrompt += `The previous lesson generation had ${allViolations.length} violation(s):\n`;
    allViolations.forEach((v, i) => {
      correctionPrompt += `  ${i + 1}. ${v}\n`;
    });
    if (langCheck.strictInstruction) {
      correctionPrompt += `\n${langCheck.strictInstruction}\n`;
    }
    correctionPrompt += `\nFix ALL violations above. Do not repeat the same mistakes.\n`;
    correctionPrompt += `=== END CORRECTION INSTRUCTIONS ===\n`;
  }

  return {
    valid,
    score,
    languageCheck: langCheck,
    structureViolations,
    pedagogyViolations,
    allViolations,
    correctionPrompt,
  };
}
