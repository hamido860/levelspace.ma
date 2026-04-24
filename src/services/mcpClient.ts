// Browser-side MCP client — all logic runs in-process (no HTTP).
// The mcp-server/ directory is the standalone stdio server for Claude Code / Claude Desktop.
// Both share the same logic; the browser imports from src/mcp/.

import {
  resolveExpectedLanguage,
  detectLanguage,
  LANG_LABELS,
  type LangCode,
} from "../mcp/languagePolicy";
import { getCurriculumEntries } from "../mcp/curriculum";
import { PEDAGOGY_RULES, getMinimumBloomLevel } from "../mcp/pedagogy";

export type { LangCode };
export { resolveExpectedLanguage, detectLanguage, LANG_LABELS };

// ─── checkLanguage ───────────────────────────────────────────────────────────

export interface CheckLanguageResult {
  compliant: boolean;
  expectedLang: LangCode | null;
  expectedLangLabel: string;
  detectedLang: string;
  isMixed: boolean;
  violations: string[];
  strictInstruction: string;
}

export function checkLanguage(input: {
  content: string;
  country: string;
  subject: string;
}): CheckLanguageResult {
  const { content, country, subject } = input;
  const expected = resolveExpectedLanguage(country, subject);
  const detected = detectLanguage(content);
  const violations: string[] = [];

  if (!expected) {
    return { compliant: true, expectedLang: null, expectedLangLabel: "Unknown", detectedLang: detected.dominant, isMixed: detected.isMixed, violations: [], strictInstruction: "" };
  }

  const expectedLabel = LANG_LABELS[expected] || expected;

  if (detected.dominant !== "unknown" && detected.dominant !== expected) {
    violations.push(`Wrong language: detected "${detected.dominant}", expected ${expectedLabel}.`);
  }

  if (detected.isMixed) {
    if (expected === "ar") {
      violations.push(`Language mixing: Arabic content has ${(detected.latinRatio * 100).toFixed(1)}% Latin text. Must be 100% Arabic.`);
    } else {
      violations.push(`Language mixing: content has ${(detected.arabicRatio * 100).toFixed(1)}% Arabic text in a ${expectedLabel}-instruction subject.`);
    }
  }

  // Detect inline translations (word (translation)) — exclude math like f(x)
  const inlineTranslations = (content.match(/\b\w+\s*\([^)]{2,30}\)/g) || [])
    .filter(m => !/^[a-zA-Z]{1,4}\s*\(/.test(m));
  if (inlineTranslations.length > 2) {
    violations.push(`Inline translations detected (${inlineTranslations.slice(0, 2).join(", ")}...). FORBIDDEN — write only in ${expectedLabel}.`);
  }

  const compliant = violations.length === 0;

  let strictInstruction = "";
  if (!compliant) {
    if (expected === "ar") {
      strictInstruction = `CRITICAL: Rewrite the ENTIRE lesson in Arabic (العربية) ONLY. Every word, title, definition, quiz option, hint, and solution must be in Arabic script. LaTeX math ($...$) is the only exception. No French, no English. No translations in parentheses. Violations: ${violations.join(" | ")}`;
    } else if (expected === "fr") {
      strictInstruction = `CRITICAL: Rewrite the ENTIRE lesson in French ONLY. No Arabic script, no English sentences. LaTeX math allowed. No inline translations. Violations: ${violations.join(" | ")}`;
    } else {
      strictInstruction = `CRITICAL: Rewrite entirely in ${expectedLabel}. No other languages. No inline translations. Violations: ${violations.join(" | ")}`;
    }
  }

  return { compliant, expectedLang: expected, expectedLangLabel: expectedLabel, detectedLang: detected.dominant, isMixed: detected.isMixed, violations, strictInstruction };
}

// ─── getCurriculum ───────────────────────────────────────────────────────────

export interface GetCurriculumResult {
  found: boolean;
  expectedLanguage: string;
  expectedLanguageCode: LangCode | null;
  promptInjection: string;
}

export function getCurriculum(input: {
  country: string;
  grade: string;
  subject: string;
}): GetCurriculumResult {
  const { country, grade, subject } = input;
  const entries = getCurriculumEntries(country, grade, subject);
  const langCode = resolveExpectedLanguage(country, subject);
  const langLabel = langCode ? LANG_LABELS[langCode] : "Unknown";

  let promptInjection = "";

  if (langCode === "ar") {
    promptInjection += `MANDATORY LANGUAGE: This subject is taught in Arabic (العربية) in ${country}. The ENTIRE lesson — titles, definitions, explanations, quiz options, hints, solutions — must be written in Arabic script. No French, no English sentences. LaTeX math only exception.\n\n`;
  } else if (langCode === "fr") {
    promptInjection += `MANDATORY LANGUAGE: This subject is taught in French in ${country}. The ENTIRE lesson must be in French. No Arabic script. LaTeX math allowed.\n\n`;
  } else if (langCode) {
    promptInjection += `MANDATORY LANGUAGE: This subject is taught in ${langLabel} in ${country}. All content must be in ${langLabel} only.\n\n`;
  }

  if (entries.length > 0) {
    const e = entries[0];
    promptInjection += `OFFICIAL CURRICULUM (${e.officialRef}):\n`;
    promptInjection += `Official topics: ${e.topics.map((t, i) => `${i + 1}. ${t}`).join(", ")}\n`;
    promptInjection += `Learning objectives: ${e.learningObjectives.join("; ")}\n`;
    promptInjection += `Assessment types: ${e.assessmentTypes.join(", ")}\n`;
    promptInjection += `The lesson topic MUST align with the official curriculum above. Do not generate content outside the official scope.`;
  } else {
    promptInjection += `No specific curriculum data found. Use the official national education ministry standards for ${country}.`;
  }

  return { found: entries.length > 0, expectedLanguage: langLabel, expectedLanguageCode: langCode, promptInjection };
}

// ─── getPedagogyRules ────────────────────────────────────────────────────────

export interface GetPedagogyRulesResult {
  minimumBloomLevel: number;
  bloomLevelName: string;
  promptInjection: string;
}

export function getPedagogyRules(input: { grade: string; subject: string }): GetPedagogyRulesResult {
  const minLevel = getMinimumBloomLevel(input.grade);
  const bloom = PEDAGOGY_RULES.bloomsTaxonomy.levels.find(l => l.level === minLevel) || PEDAGOGY_RULES.bloomsTaxonomy.levels[1];

  const promptInjection = `PEDAGOGICAL REQUIREMENTS:
1. Cognitive level: Bloom's level ${minLevel} (${bloom.name}) minimum for ${input.grade}. Students must ${bloom.keywords.slice(0, 3).join(", ")}, not just memorize.
2. Structure: Definition → intuitive real-world example → properties (bullet points) → step-by-step examples with explicit conclusion → practice.
3. No walls of text — max 3 sentences per paragraph.
4. All math must use LaTeX: $inline$ and $$block$$.
5. Quiz: 4 options minimum, all plausible distractors.
6. Exercises: step-by-step solutions, not just final answers.
7. FORBIDDEN: mixing languages, inline translations like "limite (limit)", raw math like "lim x->0".`;

  return { minimumBloomLevel: minLevel, bloomLevelName: bloom.name, promptInjection };
}

// ─── validateLesson ──────────────────────────────────────────────────────────

export interface LessonToValidate {
  title: string;
  content: string;
  blocks?: Array<{ type: string; content?: string; rules?: string[] }>;
  exercises?: Array<{ question: string; solution: string }>;
  quizzes?: Array<{ question: string; options: string[]; correctAnswer: string }>;
}

export interface ValidateLessonResult {
  valid: boolean;
  score: number;
  violations: string[];
  correctionPrompt: string;
}

export function validateLesson(input: {
  lesson: LessonToValidate;
  country: string;
  grade: string;
  subject: string;
}): ValidateLessonResult {
  const { lesson, country, grade, subject } = input;
  const violations: string[] = [];

  // Language check
  const allContent = [
    lesson.title, lesson.content,
    ...(lesson.blocks?.map(b => (b.content || "") + " " + (b.rules || []).join(" ")) || []),
    ...(lesson.exercises?.map(e => e.question + " " + e.solution) || []),
    ...(lesson.quizzes?.map(q => q.question + " " + q.options.join(" ")) || []),
  ].join("\n");

  const langCheck = checkLanguage({ content: allContent, country, subject });
  violations.push(...langCheck.violations);

  // Structure checks
  if (lesson.blocks && lesson.blocks.length < 3) {
    violations.push(`Too few blocks: ${lesson.blocks.length}, need at least 3.`);
  }
  const hasContent = lesson.blocks?.some(b => ["definition", "content"].includes(b.type));
  if (!hasContent) violations.push("Missing definition or content block.");
  const hasExamples = lesson.blocks?.some(b => b.type === "examples") || (lesson.exercises?.length ?? 0) > 0;
  if (!hasExamples) violations.push("Missing examples or exercises.");

  // Quiz options
  lesson.quizzes?.forEach((q, i) => {
    if ((q.options?.length ?? 0) < 4) violations.push(`Quiz ${i + 1}: need 4 options, has ${q.options?.length ?? 0}.`);
  });

  // Wall of text
  const longParagraphs = (lesson.content || "").split("\n\n")
    .filter(p => (p.match(/[.!?]/g) || []).length > 4).length;
  if (longParagraphs > 0) violations.push(`${longParagraphs} paragraph(s) exceed 4 sentences — use bullet points.`);

  // Raw math
  if (/lim\s+x\s*->|sqrt\s*\(/.test(lesson.content || "")) {
    violations.push("Raw math detected — use LaTeX ($...$).");
  }

  const valid = violations.length === 0;
  const score = Math.max(0, 100 - violations.length * 15);

  let correctionPrompt = "";
  if (!valid) {
    correctionPrompt = `\n=== MCP VALIDATION FAILED (${violations.length} violation(s)) ===\n`;
    violations.forEach((v, i) => { correctionPrompt += `  ${i + 1}. ${v}\n`; });
    if (langCheck.strictInstruction) correctionPrompt += `\n${langCheck.strictInstruction}\n`;
    correctionPrompt += `Fix ALL violations. Do not repeat these mistakes.\n=== END ===\n`;
  }

  return { valid, score, violations, correctionPrompt };
}

// ─── Main API ────────────────────────────────────────────────────────────────

export const mcpClient = {
  getCurriculum,
  checkLanguage,
  getPedagogyRules,
  validateLesson,

  buildPromptContext(country: string, grade: string, subject: string): string {
    const curriculum = getCurriculum({ country, grade, subject });
    const pedagogy   = getPedagogyRules({ grade, subject });
    return [
      "=== MCP CURRICULUM AUTHORITY ===",
      curriculum.promptInjection,
      "",
      "=== MCP PEDAGOGY AUTHORITY ===",
      pedagogy.promptInjection,
      "=== END MCP CONTEXT ===",
    ].join("\n");
  },

  validateAndGetCorrection(
    lesson: LessonToValidate,
    country: string,
    grade: string,
    subject: string,
  ): string | null {
    const result = validateLesson({ lesson, country, grade, subject });
    return result.valid ? null : result.correctionPrompt;
  },
};
