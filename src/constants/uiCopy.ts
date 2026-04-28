/**
 * AI can power workflows internally, but user-facing copy should emphasize
 * learning, validation, curriculum alignment, and clear actions.
 */
export const uiCopyRules = {
  avoid: [
    "AI lesson",
    "Ask AI",
    "Generate everything",
    "Magic",
    "Bot",
    "Chatbot",
  ],
  prefer: {
    "AI lesson": "Lesson draft",
    "Ask AI": "Get help",
    "Generate lesson": "Create lesson",
    "AI explanation": "Guided explanation",
    "AI scan": "Quality check",
    "AI feedback": "Feedback",
    "AI recommendations": "Suggested actions",
  },
} as const;

