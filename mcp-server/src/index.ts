import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { getCurriculum } from "./tools/getCurriculum.js";
import { validateLesson } from "./tools/validateLesson.js";
import { getPedagogyRules } from "./tools/getPedagogyRules.js";
import { checkLanguage } from "./tools/checkLanguage.js";

const server = new McpServer({
  name: "levelspace-curriculum",
  version: "1.0.0",
});

// ─── TOOL: get_curriculum ────────────────────────────────────────────────────
server.tool(
  "get_curriculum",
  "Get official curriculum topics, language policy, and learning objectives for a country/grade/subject. Call this BEFORE generating any lesson.",
  {
    country: z.string().describe("Country name (e.g. 'Morocco', 'France', 'USA')"),
    grade:   z.string().describe("Grade/level (e.g. '2ème année Bac', 'Grade 12')"),
    subject: z.string().describe("Subject name (e.g. 'Mathématiques', 'Philosophy', 'SVT')"),
  },
  async ({ country, grade, subject }) => {
    const result = getCurriculum({ country, grade, subject });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ─── TOOL: check_language ────────────────────────────────────────────────────
server.tool(
  "check_language",
  "Check if lesson content uses the correct language of instruction for this country/subject. Returns violations and a correction instruction for the AI if non-compliant.",
  {
    content: z.string().describe("The lesson content text to analyse"),
    country: z.string().describe("Country name"),
    subject: z.string().describe("Subject name"),
  },
  async ({ content, country, subject }) => {
    const result = checkLanguage({ content, country, subject });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ─── TOOL: get_pedagogy_rules ────────────────────────────────────────────────
server.tool(
  "get_pedagogy_rules",
  "Get pedagogical best practices, Bloom's taxonomy requirements, and structure rules for a given grade. Inject the returned promptInjection into lesson generation prompts.",
  {
    grade:   z.string().describe("Grade/level"),
    subject: z.string().describe("Subject name"),
  },
  async ({ grade, subject }) => {
    const result = getPedagogyRules({ grade, subject });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ─── TOOL: validate_lesson ───────────────────────────────────────────────────
server.tool(
  "validate_lesson",
  "Validate a generated lesson against language policy, curriculum scope, and pedagogical rules. Returns a correctionPrompt to inject if the lesson fails.",
  {
    lesson: z.object({
      title:     z.string(),
      content:   z.string(),
      blocks:    z.array(z.object({
        type:     z.string(),
        content:  z.string().optional(),
        rules:    z.array(z.string()).optional(),
        examples: z.array(z.any()).optional(),
        quiz:     z.any().optional(),
      })).optional(),
      exercises: z.array(z.object({
        question: z.string(),
        solution: z.string(),
      })).optional(),
      quizzes: z.array(z.object({
        question:      z.string(),
        options:       z.array(z.string()),
        correctAnswer: z.string(),
      })).optional(),
    }).describe("The generated lesson to validate"),
    country: z.string(),
    grade:   z.string(),
    subject: z.string(),
  },
  async ({ lesson, country, grade, subject }) => {
    const result = validateLesson({ lesson, country, grade, subject });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ─── RESOURCES ───────────────────────────────────────────────────────────────
server.resource(
  "pedagogy-framework",
  "pedagogy://framework",
  async () => {
    const { PEDAGOGY_RULES } = await import("./data/pedagogy.js");
    return {
      contents: [
        {
          uri: "pedagogy://framework",
          mimeType: "application/json",
          text: JSON.stringify(PEDAGOGY_RULES, null, 2),
        },
      ],
    };
  }
);

server.resource(
  "language-policy",
  "policy://language",
  async () => {
    const { SUBJECT_LANG_POLICY, LANG_LABELS } = await import("./data/languagePolicy.js");
    return {
      contents: [
        {
          uri: "policy://language",
          mimeType: "application/json",
          text: JSON.stringify({ SUBJECT_LANG_POLICY, LANG_LABELS }, null, 2),
        },
      ],
    };
  }
);

// ─── START ───────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("LevelSpace MCP server running (stdio)");
