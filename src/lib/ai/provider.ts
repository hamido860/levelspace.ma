import { embedWithGemini, generateWithGemini } from "./providers/gemini";
import { generateWithNvidia } from "./providers/nvidia";

export type AIProviderName = "gemini" | "nvidia";

export type GenerateAIResponseInput = {
  prompt: string;
  provider?: AIProviderName;
  model?: string;
  systemInstruction?: string;
  responseMimeType?: string;
  maxOutputTokens?: number;
  temperature?: number;
  fallbackEnabled?: boolean;
};

export type GenerateAIResponseResult = {
  text: string;
  provider: AIProviderName;
  model: string;
};

const MISSING_PROVIDER_MESSAGE =
  "AI provider is not configured. Please set GEMINI_API_KEY or NVIDIA_API_KEY in environment variables.";

const normalizeProvider = (value: unknown): AIProviderName | null => {
  const provider = String(value || "").toLowerCase();
  if (provider === "gemini" || provider === "nvidia") return provider;
  return null;
};

const getConfiguredProvider = () =>
  normalizeProvider(process.env.AI_PROVIDER) || "gemini";

const getFallbackProvider = (primary: AIProviderName) =>
  normalizeProvider(process.env.AI_FALLBACK_PROVIDER) || (primary === "gemini" ? "nvidia" : "gemini");

const isMissingProviderError = (error: unknown) =>
  error instanceof Error && /not configured|API_KEY|environment variables/i.test(error.message);

const callProvider = (provider: AIProviderName, input: GenerateAIResponseInput) => {
  const options = {
    prompt: input.prompt,
    model: input.model,
    systemInstruction: input.systemInstruction,
    responseMimeType: input.responseMimeType,
    maxOutputTokens: input.maxOutputTokens,
    temperature: input.temperature,
  };

  return provider === "gemini" ? generateWithGemini(options) : generateWithNvidia(options);
};

export async function generateAIResponse(input: GenerateAIResponseInput): Promise<GenerateAIResponseResult> {
  const primary = input.provider || getConfiguredProvider();
  const fallback = getFallbackProvider(primary);
  const fallbackEnabled = input.fallbackEnabled ?? process.env.AI_FALLBACK_ENABLED !== "false";
  const errors: string[] = [];

  try {
    return await callProvider(primary, input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`${primary}: ${message}`);
    console.error(`[AI Provider] ${primary} failed:`, message);
  }

  if (fallbackEnabled && fallback !== primary) {
    try {
      return await callProvider(fallback, { ...input, provider: fallback });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${fallback}: ${message}`);
      console.error(`[AI Provider] ${fallback} failed:`, message);
    }
  }

  if (errors.every((error) => isMissingProviderError(new Error(error)))) {
    throw new Error(MISSING_PROVIDER_MESSAGE);
  }

  throw new Error(errors[0] || MISSING_PROVIDER_MESSAGE);
}

export async function generateDictionaryHelp(input: GenerateAIResponseInput) {
  return generateAIResponse(input);
}

export async function generateLessonBlocks(input: GenerateAIResponseInput) {
  return generateAIResponse({ ...input, responseMimeType: input.responseMimeType || "application/json" });
}

export async function generateContextualExplanation(input: GenerateAIResponseInput) {
  return generateAIResponse(input);
}

export async function generateEmbedding(input: { text: string }) {
  return embedWithGemini(input.text);
}
