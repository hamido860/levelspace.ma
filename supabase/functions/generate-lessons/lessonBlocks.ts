export type LessonBlockType = "text" | "example" | "formula" | "summary";

export interface LessonBlockInput {
  type?: unknown;
  title?: unknown;
  label?: unknown;
  content?: unknown;
  text?: unknown;
  body?: unknown;
  points?: unknown;
  items?: unknown;
}

export interface TopicOutlineInput {
  title?: unknown;
  description?: unknown;
  outline_order?: unknown;
}

export interface NormalizedLessonBlock {
  type: LessonBlockType;
  content: string;
}

const TYPE_ALIASES: Record<string, LessonBlockType> = {
  application: "example",
  case: "example",
  demo: "example",
  exercice: "example",
  exercise: "example",
  practice: "example",
  problem: "example",
  worked_example: "example",
  equation: "formula",
  formula: "formula",
  law: "formula",
  rule: "formula",
  theorem: "formula",
  conclusion: "summary",
  objective: "summary",
  objectives: "summary",
  recap: "summary",
  revision: "summary",
  summary: "summary",
  definition: "text",
  explanation: "text",
  intro: "text",
  introduction: "text",
  note: "text",
  theory: "text",
  text: "text",
};

const cleanText = (value: unknown) =>
  String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

const normalizeTypeKey = (value: unknown) =>
  cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const normalizeLessonBlockType = (value: unknown): LessonBlockType => {
  const key = normalizeTypeKey(value);
  return TYPE_ALIASES[key] || "text";
};

const stringifyContentValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map(stringifyContentValue).filter(Boolean).join("\n");
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [
      record.title,
      record.label,
      record.content,
      record.text,
      record.body,
      record.description,
    ].map(stringifyContentValue).filter(Boolean).join("\n");
  }

  return cleanText(value);
};

export const normalizeLessonBlocks = (blocks: unknown): NormalizedLessonBlock[] => {
  if (!Array.isArray(blocks)) return [];

  return blocks.flatMap((block): NormalizedLessonBlock[] => {
    if (!block || typeof block !== "object") return [];

    const record = block as LessonBlockInput;
    const heading = cleanText(record.title) || cleanText(record.label);
    const body = [
      record.content,
      record.text,
      record.body,
      record.points,
      record.items,
    ].map(stringifyContentValue).filter(Boolean).join("\n");
    const content = [heading, body].filter(Boolean).join("\n\n").trim();

    if (!content) return [];

    return [{
      type: normalizeLessonBlockType(record.type),
      content,
    }];
  });
};

export const buildFallbackBlocksFromOutlines = (
  topicTitle: string,
  outlines: TopicOutlineInput[]
): NormalizedLessonBlock[] => {
  const fallback: NormalizedLessonBlock[] = [{
    type: "summary",
    content: `Lesson outline for ${cleanText(topicTitle) || "this topic"}`,
  }];

  for (const outline of outlines) {
    const title = cleanText(outline.title);
    const description = cleanText(outline.description);
    const content = [title, description].filter(Boolean).join("\n\n").trim();
    if (!content) continue;
    fallback.push({ type: "text", content });
  }

  return fallback;
};
