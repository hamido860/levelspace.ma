import { describe, it, expect } from "vitest";
import { buildMcpLessonPrompt, BuildMcpLessonPromptInput } from "./buildMcpLessonPrompt";

describe("buildMcpLessonPrompt", () => {
  it("should build a prompt for learner_light", () => {
    const input: BuildMcpLessonPromptInput = {
      pipelineType: "learner_light",
      topic: {
        id: "1",
        title: "Test Topic",
        grade: "Grade 10",
        subject: "Math",
      },
      topicOutlines: [],
      trustedSources: [],
      materialRequirements: [],
    };
    const result = buildMcpLessonPrompt(input);
    expect(result).toContain("You are the LevelSpace MCP lesson orchestrator for pipeline: learner_light.");
    expect(result).toContain("Topic ID: 1");
    expect(result).toContain("No explicit material requirements.");
  });

  it("should build a prompt for admin_heavy with details", () => {
    const input: BuildMcpLessonPromptInput = {
      pipelineType: "admin_heavy",
      topic: {
        id: "2",
        title: "Advanced Biology",
        grade: "Grade 12",
        subject: "Biology",
      },
      topicOutlines: [
        { title: "Cell Structure", description: "Learn about cells", outline_order: 1 }
      ],
      trustedSources: [
        { source_name: "BioBook", source_type: "textbook", trust_tier: "high" }
      ],
      materialRequirements: [
        { material_type: "diagram", title: "Cell diagram", required: true }
      ],
      learnerContext: {
        level: "advanced",
        priorKnowledge: "Basic biology"
      }
    };
    const result = buildMcpLessonPrompt(input);
    expect(result).toContain("You are the LevelSpace MCP lesson orchestrator for pipeline: admin_heavy.");
    expect(result).toContain("Topic ID: 2");
    expect(result).toContain("1. Cell Structure: Learn about cells");
    expect(result).toContain("1. BioBook | type=textbook | tier=high | license=unknown | confidence=unknown");
    expect(result).toContain("1. diagram | Cell diagram | required=true");
    expect(result).toContain("Level: advanced");
    expect(result).toContain("Prior knowledge: Basic biology");
  });
});
