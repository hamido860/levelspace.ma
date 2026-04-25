import { getCurriculumEntries, CurriculumEntry } from "../data/curriculum.js";
import { resolveExpectedLanguage, LANG_LABELS } from "../data/languagePolicy.js";

export interface GetCurriculumInput {
  country: string;
  grade: string;
  subject: string;
}

export interface GetCurriculumResult {
  found: boolean;
  entries: CurriculumEntry[];
  expectedLanguage: string;
  expectedLanguageCode: string | null;
  promptInjection: string; // Ready-to-use text to inject into generation prompt
}

export function getCurriculum(input: GetCurriculumInput): GetCurriculumResult {
  const { country, grade, subject } = input;

  const entries = getCurriculumEntries(country, grade, subject);
  const langCode = resolveExpectedLanguage(country, subject);
  const langLabel = langCode ? LANG_LABELS[langCode] : "Unknown";

  // Build a rich prompt injection from found curriculum data
  let promptInjection = "";

  if (langCode) {
    if (langCode === "ar") {
      promptInjection += `MANDATORY LANGUAGE: This subject is taught in Arabic (العربية) in ${country}. ` +
        `The ENTIRE lesson — titles, definitions, explanations, quiz options, hints, solutions — ` +
        `must be written in Arabic script. No French, no English sentences. LaTeX math only exception.\n\n`;
    } else if (langCode === "fr") {
      promptInjection += `MANDATORY LANGUAGE: This subject is taught in French (Français) in ${country}. ` +
        `The ENTIRE lesson must be in French. No Arabic script in main content. LaTeX math allowed.\n\n`;
    } else {
      promptInjection += `MANDATORY LANGUAGE: This subject is taught in ${langLabel} in ${country}. ` +
        `All content must be in ${langLabel} only.\n\n`;
    }
  }

  if (entries.length > 0) {
    const entry = entries[0];
    promptInjection += `OFFICIAL CURRICULUM (${entry.officialRef}):\n`;
    promptInjection += `Official topics for ${entry.grade} ${entry.subject} in ${entry.country}:\n`;
    promptInjection += entry.topics.map((t, i) => `  ${i + 1}. ${t}`).join("\n");
    promptInjection += `\n\nLearning objectives:\n`;
    promptInjection += entry.learningObjectives.map(o => `  - ${o}`).join("\n");
    promptInjection += `\n\nAssessment types: ${entry.assessmentTypes.join(", ")}`;
    promptInjection += `\n\nCRITICAL: The lesson topic MUST align with the above official curriculum. ` +
      `Do not generate content outside the official scope.`;
  } else {
    promptInjection += `No specific curriculum data found for ${subject} in ${country} (${grade}). ` +
      `Use official national educational standards for this country. ` +
      `Search for the official ministry of education syllabus.`;
  }

  return {
    found: entries.length > 0,
    entries,
    expectedLanguage: langLabel,
    expectedLanguageCode: langCode,
    promptInjection,
  };
}
