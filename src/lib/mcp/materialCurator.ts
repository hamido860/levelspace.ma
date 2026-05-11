import { supabase } from "../../db/supabase";
import { McpMaterialRequirement } from "./buildMcpLessonPrompt";

export interface CuratedMaterialRequest {
  topic_id: string;
  material_type: string;
  title: string;
  purpose: string;
  required: boolean;
  approved: boolean;
  license_type: string;
  attribution: string;
  source_url: string | null;
  metadata: Record<string, unknown>;
}

const normalize = (value: unknown) => String(value ?? "").trim();

const isDecorativeMismatch = (requirement: McpMaterialRequirement) => {
  const materialType = normalize(requirement.material_type).toLowerCase();
  const title = normalize(requirement.title).toLowerCase();
  const purpose = normalize(requirement.purpose).toLowerCase();
  if (materialType === "map") {
    return /(landscape|photo|decorative|wallpaper|background)/i.test(`${title} ${purpose}`);
  }
  return false;
};

export const buildMaterialRequestsFromRequirements = (
  topicId: string,
  requirements: McpMaterialRequirement[],
): CuratedMaterialRequest[] =>
  requirements
    .filter((requirement) => requirement.required !== false)
    .map((requirement) => {
      const materialType = normalize(requirement.material_type) || "material";
      const rejectedDecorativeMismatch = isDecorativeMismatch(requirement);
      return {
        topic_id: topicId,
        material_type: "material_request",
        title: normalize(requirement.title) || `${materialType} request`,
        purpose: normalize(requirement.purpose) || `Find or attach a verified ${materialType}.`,
        required: true,
        approved: false,
        license_type: "pending",
        attribution: "",
        source_url: null,
        metadata: {
          requested_material_type: materialType,
          search_query: normalize(requirement.search_query) || null,
          status: normalize(requirement.status) || "requested",
          rejected_decorative_mismatch: rejectedDecorativeMismatch,
          policy: materialType === "map"
            ? "Do not accept a generic landscape/photo for a map requirement unless it is explicitly useful."
            : "Pending source curator integration.",
        },
      };
    });

export const createMaterialRequestRows = async (
  lessonId: string,
  topicId: string,
  requirements: McpMaterialRequirement[],
) => {
  const rows = buildMaterialRequestsFromRequirements(topicId, requirements).map((row) => ({
    ...row,
    lesson_id: lessonId,
  }));

  if (rows.length === 0) return [];

  const { data, error } = await supabase
    .from("lesson_materials")
    .insert(rows)
    .select("*");

  if (error) throw new Error(`Unable to create material request rows: ${error.message}`);
  return Array.isArray(data) ? data : [];
};
