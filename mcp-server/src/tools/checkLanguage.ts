import { detectLanguage, resolveExpectedLanguage, LANG_LABELS, LangCode } from "../data/languagePolicy.js";

export interface CheckLanguageInput {
  content: string;
  country: string;
  subject: string;
}

export interface CheckLanguageResult {
  compliant: boolean;
  expectedLang: LangCode | null;
  expectedLangLabel: string;
  detectedLang: string;
  isMixed: boolean;
  violations: string[];
  strictInstruction: string; // Injected into the AI prompt to fix violations
}

export function checkLanguage(input: CheckLanguageInput): CheckLanguageResult {
  const { content, country, subject } = input;

  const expected = resolveExpectedLanguage(country, subject);
  const detected = detectLanguage(content);

  const violations: string[] = [];

  if (!expected) {
    return {
      compliant: true,
      expectedLang: null,
      expectedLangLabel: "Unknown (no policy)",
      detectedLang: detected.dominant,
      isMixed: detected.isMixed,
      violations: [],
      strictInstruction: "",
    };
  }

  const expectedLabel = LANG_LABELS[expected] || expected;

  // Check dominant language matches
  if (detected.dominant !== "unknown" && detected.dominant !== expected) {
    violations.push(
      `Wrong language: content appears to be in "${detected.dominant}" but must be in ${expectedLabel}.`
    );
  }

  // Check for mixing
  if (detected.isMixed) {
    if (expected === "ar") {
      violations.push(
        `Language mixing detected: Arabic content contains significant Latin text (${(detected.latinRatio * 100).toFixed(1)}%). ` +
        `No French or English sentences allowed in Arabic-instruction subjects.`
      );
    } else {
      violations.push(
        `Language mixing detected: content contains significant Arabic text (${(detected.arabicRatio * 100).toFixed(1)}%) ` +
        `in a ${expectedLabel}-instruction subject.`
      );
    }
  }

  // Check for inline translations (parentheses pattern: word (translation))
  const inlineTranslationPattern = /\b\w+\s*\([^)]{2,30}\)/g;
  const matches = content.match(inlineTranslationPattern) || [];
  const suspiciousTranslations = matches.filter(m => {
    // Exclude math expressions like f(x), sin(x), etc.
    return !/^[a-zA-Z]{1,4}\s*\(/.test(m);
  });
  if (suspiciousTranslations.length > 2) {
    violations.push(
      `Inline translations detected (${suspiciousTranslations.slice(0, 3).join(", ")}...). ` +
      `Providing translations in parentheses is FORBIDDEN. Write only in ${expectedLabel}.`
    );
  }

  const compliant = violations.length === 0;

  // Build strict instruction for AI regeneration
  let strictInstruction = "";
  if (!compliant) {
    if (expected === "ar") {
      strictInstruction =
        `CRITICAL LANGUAGE VIOLATION DETECTED. You MUST rewrite the ENTIRE lesson in Arabic (العربية) ONLY. ` +
        `Every word, every sentence, every title, every option must be in Arabic script. ` +
        `Do NOT include any French, English, or Latin characters in the main content. ` +
        `LaTeX math expressions ($...$) are the ONLY exception. ` +
        `Do NOT provide translations in parentheses. Violations found: ${violations.join(" | ")}`;
    } else if (expected === "fr") {
      strictInstruction =
        `CRITICAL LANGUAGE VIOLATION DETECTED. You MUST rewrite the ENTIRE lesson in French ONLY. ` +
        `Every word must be in French. No Arabic script, no English sentences. ` +
        `Do NOT provide translations in parentheses. LaTeX math is allowed. ` +
        `Violations found: ${violations.join(" | ")}`;
    } else {
      strictInstruction =
        `CRITICAL LANGUAGE VIOLATION DETECTED. Rewrite entirely in ${expectedLabel}. ` +
        `No other languages. No inline translations. Violations: ${violations.join(" | ")}`;
    }
  }

  return {
    compliant,
    expectedLang: expected,
    expectedLangLabel: expectedLabel,
    detectedLang: detected.dominant,
    isMixed: detected.isMixed,
    violations,
    strictInstruction,
  };
}
