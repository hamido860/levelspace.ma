import { McpMaterialRequirement } from "./buildMcpLessonPrompt";

export interface LessonMaterialLike {
  id?: string;
  material_type?: string | null;
  title?: string | null;
  purpose?: string | null;
  approved?: boolean | null;
  required?: boolean | null;
  metadata?: Record<string, any> | null;
}

export interface MaterialAlignmentIssue {
  check_category: "material_alignment" | "schema_validity";
  status: "pass" | "warning" | "fail";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  evidence: Record<string, any>;
}

export interface MaterialAlignmentResult {
  issues: MaterialAlignmentIssue[];
  materialRequests: LessonMaterialLike[];
}

const normalize = (value: unknown) => String(value ?? "").toLowerCase();

const blockText = (blocks: unknown) => {
  if (!Array.isArray(blocks)) return normalize(blocks);
  return blocks.map((block) => {
    if (!block || typeof block !== "object") return String(block ?? "");
    const record = block as Record<string, unknown>;
    return [record.type, record.title, record.label, record.content, record.text, record.body]
      .map((part) => String(part ?? ""))
      .join(" ");
  }).join("\n").toLowerCase();
};

const hasMaterialType = (
  materialTypes: string[],
  requirements: McpMaterialRequirement[],
  materials: LessonMaterialLike[],
) => {
  const wanted = new Set(materialTypes.map((item) => item.toLowerCase()));
  return [...requirements, ...materials].some((item) => wanted.has(normalize(item.material_type)));
};

const hasFormulaBlock = (blocks: unknown) =>
  Array.isArray(blocks) && blocks.some((block) => block && typeof block === "object" && normalize((block as any).type).includes("formula"));

const hasSafetyNote = (blocks: unknown) =>
  Array.isArray(blocks) && blocks.some((block) => {
    if (!block || typeof block !== "object") return false;
    const record = block as Record<string, unknown>;
    return normalize(record.type).includes("safety") || normalize(record.content).includes("safety") || normalize(record.content).includes("sécurité");
  });

const createRequest = (
  materialType: string,
  purpose: string,
  searchQuery?: string | null,
): LessonMaterialLike => ({
  material_type: "material_request",
  title: `${materialType} needed`,
  purpose,
  required: true,
  approved: false,
  metadata: {
    requested_material_type: materialType,
    search_query: searchQuery ?? null,
  },
});

export const validateMaterialAlignment = (
  blocks: unknown,
  materialRequirements: McpMaterialRequirement[],
  lessonMaterials: LessonMaterialLike[],
): MaterialAlignmentResult => {
  const text = blockText(blocks);
  const issues: MaterialAlignmentIssue[] = [];
  const materialRequests: LessonMaterialLike[] = [];

  const addIssue = (
    status: "warning" | "fail",
    severity: "medium" | "high",
    message: string,
    evidence: Record<string, any>,
  ) => {
    issues.push({ check_category: "material_alignment", status, severity, message, evidence });
  };

  if (/(^|\W)(map|carte|خريطة)(\W|$)/i.test(text) && !hasMaterialType(["map"], materialRequirements, lessonMaterials)) {
    const requirement = materialRequirements.find((item) => normalize(item.material_type) === "map");
    materialRequests.push(createRequest("map", "Lesson references a map and needs an approved map material.", requirement?.search_query));
    addIssue("warning", "high", "Lesson references a map but no map material is attached.", { required_material_type: "map" });
  }

  if (/(diagram|schéma|schema|رسم|مبيان)/i.test(text) && !hasMaterialType(["diagram", "chart"], materialRequirements, lessonMaterials)) {
    const requirement = materialRequirements.find((item) => ["diagram", "chart"].includes(normalize(item.material_type)));
    materialRequests.push(createRequest("diagram", "Lesson references a diagram/chart and needs an approved visual material.", requirement?.search_query));
    addIssue("warning", "high", "Lesson references a diagram or chart but no diagram/chart material is attached.", { required_material_type: "diagram_or_chart" });
  }

  if (/(formula|formule|équation|equation|صيغة|معادلة)/i.test(text) && !hasFormulaBlock(blocks)) {
    issues.push({
      check_category: "schema_validity",
      status: "warning",
      severity: "medium",
      message: "Lesson references a formula but does not include a formula block.",
      evidence: { required_block_type: "formula" },
    });
  }

  if (/(experiment|expérience|experience|تجربة)/i.test(text) && !hasMaterialType(["experiment_protocol"], materialRequirements, lessonMaterials) && !hasSafetyNote(blocks)) {
    materialRequests.push(createRequest("experiment_protocol", "Lesson references an experiment and needs a protocol or safety note."));
    addIssue("fail", "high", "Lesson references an experiment but no experiment protocol or safety note is attached.", { required_material_type: "experiment_protocol" });
  }

  if (issues.length === 0) {
    issues.push({
      check_category: "material_alignment",
      status: "pass",
      severity: "low",
      message: "Lesson materials align with referenced maps, diagrams, formulas, and experiments.",
      evidence: { checked_rules: ["map", "diagram", "formula", "experiment"] },
    });
  }

  return { issues, materialRequests };
};
