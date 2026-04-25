import { PEDAGOGY_RULES, getMinimumBloomLevel } from "../data/pedagogy.js";

export interface GetPedagogyRulesInput {
  grade: string;
  subject: string;
}

export interface GetPedagogyRulesResult {
  minimumBloomLevel: number;
  bloomLevelName: string;
  contentRules: string[];
  languageRules: string[];
  structureSchema: typeof PEDAGOGY_RULES.structureSchema;
  promptInjection: string;
}

export function getPedagogyRules(input: GetPedagogyRulesInput): GetPedagogyRulesResult {
  const { grade } = input;

  const minLevel = getMinimumBloomLevel(grade);
  const bloomLevel = PEDAGOGY_RULES.bloomsTaxonomy.levels.find(l => l.level === minLevel)
    || PEDAGOGY_RULES.bloomsTaxonomy.levels[1];

  const promptInjection = `
PEDAGOGICAL REQUIREMENTS (strictly enforced):

1. COGNITIVE LEVEL: Minimum Bloom's level ${minLevel} (${bloomLevel.name}) for ${grade}.
   The lesson must require students to ${bloomLevel.keywords.slice(0, 3).join(", ")} — not just memorize.

2. STRUCTURE (required):
   - Definition block: clear, concise, followed immediately by a real-world intuitive example
   - Explanation: break down WHY, not just WHAT. Max 3 sentences per paragraph.
   - Examples block: step-by-step solutions with explicit conclusion ("Therefore, ...")
   - Practice/Quiz: minimum 4 options per MCQ, all plausible distractors

3. CONTENT RULES:
${PEDAGOGY_RULES.contentRules.map(r => `   - ${r}`).join("\n")}

4. FORBIDDEN PATTERNS:
   - Walls of text (paragraph > 4 sentences)
   - Definitions without examples
   - Exercises without step-by-step solutions
   - Mixed languages in content
   - Inline translations like "limite (limit)"

5. MATH FORMATTING:
   - Inline math: $expression$ — e.g., $f(x) = x^2$
   - Block math: $$expression$$ — for displayed equations
   - NEVER write math as raw text like "lim x->0" or "x^2"
`.trim();

  return {
    minimumBloomLevel: minLevel,
    bloomLevelName: bloomLevel.name,
    contentRules: PEDAGOGY_RULES.contentRules,
    languageRules: PEDAGOGY_RULES.languageRules,
    structureSchema: PEDAGOGY_RULES.structureSchema,
    promptInjection,
  };
}
