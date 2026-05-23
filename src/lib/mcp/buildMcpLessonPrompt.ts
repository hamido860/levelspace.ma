export type McpPipelineType = "admin_heavy" | "learner_light" | "remedial_micro_lesson" | "exam_practice";

export interface McpPromptTopic {
  id: string;
  title: string;
  grade: string;
  cycle?: string | null;
  subject: string;
  domain?: string | null;
}

export interface McpTopicOutline {
  title?: string | null;
  description?: string | null;
  outline_order?: number | null;
}

export interface McpTrustedSource {
  source_name?: string | null;
  source_type?: string | null;
  trust_tier?: string | number | null;
  source_url?: string | null;
  license_type?: string | null;
  excerpt?: string | null;
  used_for?: string | null;
  confidence?: number | null;
}

export interface McpMaterialRequirement {
  material_type?: string | null;
  title?: string | null;
  purpose?: string | null;
  required?: boolean | null;
  search_query?: string | null;
  status?: string | null;
}

export interface McpLearnerContext {
  level?: string;
  priorKnowledge?: string;
  commonDifficulties?: string;
  preferredExplanationStyle?: string;
  learningGoal?: string;
}

export interface BuildMcpLessonPromptInput {
  pipelineType: McpPipelineType;
  topic: McpPromptTopic;
  topicOutlines: McpTopicOutline[];
  trustedSources: McpTrustedSource[];
  materialRequirements: McpMaterialRequirement[];
  learnerContext?: McpLearnerContext;
}

const clean = (value: unknown) => String(value ?? "").trim();

const listOrFallback = <T,>(items: T[], render: (item: T, index: number) => string, fallback: string) =>
  items.length > 0 ? items.map(render).join("\n") : fallback;

const getSourcePolicy = (pipelineType: McpPipelineType) => {
  if (pipelineType === "learner_light") {
    return [
      "Prefer already verified lessons when available.",
      "Use topic outlines for quick explanation only when no verified lesson is available.",
      "Do not present unverified draft content as official.",
      "Keep the answer short, concrete, and learner-safe.",
    ].join("\n- ");
  }

  return [
    "Ground claims in trusted sources, approved RAG chunks, or topic_outlines.",
    "If evidence is missing, mark the lesson as needs_review and state the gap in the quality report.",
    "Do not invent textbook references, maps, diagrams, experiments, or official exam claims.",
    "Every required visual/material mentioned by the lesson must be present or requested.",
    "Use the exact grade and subject context. Do not assume Bac unless the grade explicitly says Bac.",
  ].join("\n- ");
};

const getPedagogyRules = (pipelineType: McpPipelineType) => {
  const shared = [
    "Start from prior knowledge and build toward the target concept.",
    "Use short definitions, one worked example, and one misconception check.",
    "Keep vocabulary aligned to the grade level.",
    "Use culturally neutral examples unless curriculum context requires local examples.",
  ];

  if (pipelineType === "exam_practice") {
    shared.push("Include exam-style reasoning, marking cues, and common traps.");
  }

  if (pipelineType === "remedial_micro_lesson") {
    shared.push("Use very small steps, one concept at a time, and a confidence-building check question.");
  }

  if (pipelineType === "admin_heavy") {
    shared.push("Align each section to the topic outline and cite which source/material supports it.");
  }

  return shared.map((rule) => `- ${rule}`).join("\n");
};

const getSubjectRules = (subject: string) => {
  const normalized = subject.toLowerCase();
  if (normalized.includes("math")) {
    return [
      "For mathematics, include precise definitions, formulas when needed, and step-by-step transformations.",
      "Geometry lessons that mention a figure must require a diagram material.",
      "Do not hide assumptions in examples.",
    ].join("\n");
  }

  if (normalized.includes("geo") || normalized.includes("histoire") || normalized.includes("history")) {
    return [
      "For geography/history, maps, timelines, and source excerpts must be explicitly attached or requested.",
      "Never say 'observe the map below' unless a map material exists.",
      "Separate facts, interpretation, and learner tasks.",
    ].join("\n");
  }

  if (normalized.includes("phys") || normalized.includes("science") || normalized.includes("svt")) {
    return [
      "For science, include observation, hypothesis, explanation, and safety notes for experiments.",
      "Experiments require an experiment_protocol or a clear safety note.",
      "Diagrams or charts must be attached or requested when referenced.",
    ].join("\n");
  }

  return "Use subject-appropriate terminology, examples, and practice tasks. Avoid unsupported claims.";
};


const buildCurriculumContext = (topic: McpPromptTopic) => [
  `Topic ID: ${topic.id}`,
  `Topic: ${topic.title}`,
  `Grade: ${topic.grade}`,
  `Cycle: ${topic.cycle || "unknown"}`,
  `Subject: ${topic.subject}`,
  `Domain: ${topic.domain || "not specified"}`,
].join("\n");

const buildLearnerBlock = (learnerContext?: McpLearnerContext) =>
  learnerContext
    ? [
        `Level: ${learnerContext.level || "not specified"}`,
        `Prior knowledge: ${learnerContext.priorKnowledge || "not specified"}`,
        `Common difficulties: ${learnerContext.commonDifficulties || "not specified"}`,
        `Preferred explanation style: ${learnerContext.preferredExplanationStyle || "not specified"}`,
        `Learning goal: ${learnerContext.learningGoal || "not specified"}`,
      ].join("\n")
    : "No individual learner context supplied. Use the exact grade as the main adaptation signal.";

const buildOutlines = (topicOutlines: McpTopicOutline[]) =>
  listOrFallback(
    topicOutlines,
    (outline, index) =>
      `${index + 1}. ${clean(outline.title) || "Untitled outline"}${
        clean(outline.description) ? `: ${clean(outline.description)}` : ""
      }`,
    "No topic_outlines available. Build a cautious draft and mark missing outline evidence in the quality report.",
  );

const buildSources = (trustedSources: McpTrustedSource[]) =>
  listOrFallback(
    trustedSources,
    (source, index) =>
      [
        `${index + 1}. ${clean(source.source_name) || "Unnamed source"}`,
        `type=${clean(source.source_type) || "unknown"}`,
        `tier=${clean(source.trust_tier) || "unknown"}`,
        `license=${clean(source.license_type) || "unknown"}`,
        `confidence=${source.confidence ?? "unknown"}`,
        clean(source.source_url) ? `url=${clean(source.source_url)}` : "",
        clean(source.used_for) ? `used_for=${clean(source.used_for)}` : "",
        clean(source.excerpt) ? `excerpt=${clean(source.excerpt)}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    "No trusted source excerpts available. Use topic_outlines only and mark source_grounding as warning.",
  );

const buildMaterials = (materialRequirements: McpMaterialRequirement[]) =>
  listOrFallback(
    materialRequirements,
    (requirement, index) =>
      [
        `${index + 1}. ${clean(requirement.material_type) || "material"}`,
        clean(requirement.title) || "Untitled material requirement",
        `required=${requirement.required === false ? "false" : "true"}`,
        clean(requirement.purpose) ? `purpose=${clean(requirement.purpose)}` : "",
        clean(requirement.search_query) ? `search_query=${clean(requirement.search_query)}` : "",
        clean(requirement.status) ? `status=${clean(requirement.status)}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    "No explicit material requirements. If the lesson needs a map, diagram, chart, formula display, or experiment protocol, create a material_request in the JSON.",
  );

const getQualityChecklist = () =>
  [
    "Curriculum sections match the topic outlines.",
    "Grade language and examples match the exact grade.",
    "Every source-backed claim has source_refs or is clearly draft.",
    "Every mentioned map/diagram/chart/experiment/formula has a matching material or material_request.",
    "No official/published wording is used for needs_review content.",
    "JSON is valid and matches the schema exactly.",
  ]
    .map((item) => `- ${item}`)
    .join("\n");

export const buildMcpLessonPrompt = (input: BuildMcpLessonPromptInput) => {
  const { pipelineType, topic, topicOutlines, trustedSources, materialRequirements, learnerContext } = input;
  const adminHeavy = pipelineType === "admin_heavy";

  const curriculumContext = buildCurriculumContext(topic);
  const learnerBlock = buildLearnerBlock(learnerContext);
  const outlines = buildOutlines(topicOutlines);
  const sources = buildSources(trustedSources);
  const materials = buildMaterials(materialRequirements);

  const schema = adminHeavy
    ? `{
  "lesson_title": "string",
  "content": "markdown string",
  "blocks": [
    { "type": "text|example|formula|summary|material_request|safety_note", "title": "string", "content": "string", "source_refs": ["string"], "material_refs": ["string"] }
  ],
  "exercises": [{ "question": "string", "solution": "string", "source_refs": ["string"] }],
  "quizzes": [{ "question": "string", "options": ["A","B","C","D"], "correctAnswer": "A", "explanation": "string" }],
  "materials_used": [{ "material_type": "map|diagram|chart|formula|experiment_protocol|material_request", "title": "string", "purpose": "string", "source_url": "string", "license_type": "string", "approved": false }],
  "quality_report": {
    "curriculum_alignment": "pass|warning|fail",
    "source_grounding": "pass|warning|fail",
    "grade_alignment": "pass|warning|fail",
    "material_alignment": "pass|warning|fail",
    "language_quality": "pass|warning|fail",
    "pedagogical_quality": "pass|warning|fail",
    "schema_validity": "pass|warning|fail",
    "notes": ["string"]
  }
}`
  : `{
  "mode": "${pipelineType}",
  "topic": "string",
  "explanation": "string",
  "simple_example": "string",
  "common_mistake": "string",
  "check_question": "string",
  "answer": "string",
  "confidence": 0,
  "based_on": "verified_lesson|topic_outline|rag_chunk"
}`;

export const buildMcpLessonPrompt = (input: BuildMcpLessonPromptInput) => {
  const { pipelineType, topic, topicOutlines, trustedSources, materialRequirements, learnerContext } = input;

  return [
    `You are the LevelSpace MCP lesson orchestrator for pipeline: ${pipelineType}.`,
    "",
    "CURRICULUM CONTEXT",
    buildCurriculumContext(topic),
    "",
    "LEARNER CONTEXT",
    buildLearnerBlock(learnerContext),
    "",
    "SOURCE POLICY",
    `- ${getSourcePolicy(pipelineType)}`,
    "",
    "TOPIC OUTLINES",
    buildOutlines(topicOutlines),
    "",
    "TRUSTED SOURCES / EVIDENCE",
    buildSources(trustedSources),
    "",
    "REQUIRED MATERIALS",
    buildMaterials(materialRequirements),
    "",
    "PEDAGOGICAL TECHNIQUES",
    getPedagogyRules(pipelineType),
    "",
    "SUBJECT-SPECIFIC TEACHING RULES",
    getSubjectRules(topic.subject),
    "",
    "QUALITY CHECKLIST",
    getQualityChecklist(),
    "",
    "STRICT OUTPUT",
    "Return ONLY valid JSON. No markdown fence. No commentary outside JSON.",
    getSchema(pipelineType),
  ].join("\n");
};
