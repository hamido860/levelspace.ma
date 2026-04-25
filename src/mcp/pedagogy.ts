// Pedagogical best practices enforced by the MCP server

export const PEDAGOGY_RULES = {
  lessonStructure: {
    required: ["definition", "explanation", "examples", "practice"],
    optional: ["quiz", "exam", "summary"],
    forbidden: ["wall_of_text", "untranslated_terms", "language_mixing"],
  },

  bloomsTaxonomy: {
    levels: [
      { level: 1, name: "Remember",    arName: "التذكر",    keywords: ["define", "list", "recall", "name", "identify"] },
      { level: 2, name: "Understand",  arName: "الفهم",     keywords: ["explain", "describe", "summarize", "interpret"] },
      { level: 3, name: "Apply",       arName: "التطبيق",   keywords: ["solve", "use", "calculate", "demonstrate"] },
      { level: 4, name: "Analyze",     arName: "التحليل",   keywords: ["compare", "differentiate", "examine", "break down"] },
      { level: 5, name: "Evaluate",    arName: "التقييم",   keywords: ["justify", "critique", "assess", "argue"] },
      { level: 6, name: "Create",      arName: "الإبداع",   keywords: ["design", "construct", "formulate", "develop"] },
    ],
    minimumLevel: {
      "Primary":   1,
      "Middle":    2,
      "Tronc Commun": 2,
      "1ère année Bac": 3,
      "2ème année Bac": 4,
      "Grade 9":   2,
      "Grade 10":  3,
      "Grade 11":  3,
      "Grade 12":  4,
      "Terminale": 4,
    },
  },

  contentRules: [
    "Never write a wall of text — max 3 sentences per paragraph",
    "Every definition must be followed by a real-world intuitive example",
    "All math must use LaTeX formatting ($ for inline, $$ for block)",
    "Key terms must be bolded on first use",
    "Exercises must have step-by-step solutions, not just answers",
    "Quiz options must be plausible — avoid obviously wrong distractors",
    "Exam questions must match the official national exam format for the country",
  ],

  languageRules: [
    "Lesson content must be 100% in the official language of instruction",
    "No inline translations in parentheses (e.g., 'limite (limit)' is FORBIDDEN)",
    "No mixing scripts — Arabic content must not contain Latin sentences",
    "Technical terms may remain in their original scientific language if universally accepted",
    "LaTeX math expressions are language-neutral and always allowed",
  ],

  structureSchema: {
    minBlocks: 3,
    maxBlockContentLength: 1500,
    requiredBlockTypes: ["definition", "examples"],
    quizMinOptions: 4,
    exerciseMinSteps: 2,
  },
};

export function getMinimumBloomLevel(grade: string): number {
  const g = grade.toLowerCase();
  for (const [key, level] of Object.entries(PEDAGOGY_RULES.bloomsTaxonomy.minimumLevel)) {
    if (g.includes(key.toLowerCase())) return level;
  }
  return 2; // default
}
