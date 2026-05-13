import { embedWithGemini, generateWithGemini } from "./providers/gemini";
import { generateWithNvidia } from "./providers/nvidia";
import { generateWithOpenAI } from "./providers/openai";
import { generateWithOpenRouter } from "./providers/openrouter";
import { getDecryptedUserAiKey, normalizeUserAiProvider } from "../../server/aiKeys";
import { getServerSupabase } from "../../server/api/aiCommandCenter";

export type AIProviderName = "gemini" | "nvidia" | "openrouter" | "openai";
export type AICredentialMode = "byok" | "platform";

export type GenerateAIResponseInput = {
  prompt: string;
  provider?: AIProviderName;
  model?: string;
  systemInstruction?: string;
  responseMimeType?: string;
  maxOutputTokens?: number;
  temperature?: number;
  fallbackEnabled?: boolean;
  credentialMode?: AICredentialMode;
  userId?: string;
};

export type GenerateAIResponseResult = {
  text: string;
  provider: AIProviderName;
  model: string;
};

const MISSING_PROVIDER_MESSAGE =
  "AI provider is not configured. Save your own API key or enable platform AI credits.";

const normalizeProvider = (value: unknown): AIProviderName | null => {
  const provider = String(value || "").toLowerCase();
  if (provider === "gemini" || provider === "nvidia" || provider === "openrouter" || provider === "openai") return provider;
  return null;
};

const getConfiguredProvider = () =>
  normalizeProvider(process.env.AI_PROVIDER) || "gemini";

const getFallbackProvider = (primary: AIProviderName) =>
  normalizeProvider(process.env.AI_FALLBACK_PROVIDER) || (primary === "gemini" ? "nvidia" : "gemini");

const isMissingProviderError = (error: unknown) =>
  error instanceof Error && /not configured|API_KEY|environment variables/i.test(error.message);

const getPlatformKey = (provider: AIProviderName) => {
  if (provider === "gemini") return process.env.GEMINI_API_KEY || process.env.GEMINI_KEY_0 || "";
  if (provider === "openrouter") return process.env.OPENROUTER_API_KEY || "";
  if (provider === "openai") return process.env.OPENAI_API_KEY || "";
  if (provider === "nvidia") return process.env.NVIDIA_API_KEY || "";
  return "";
};

const isPlatformEnabled = () => process.env.AI_PLATFORM_CREDITS_ENABLED !== "false";

const resolveApiKey = async (provider: AIProviderName, input: GenerateAIResponseInput) => {
  if (input.credentialMode === "byok") {
    const byokProvider = normalizeUserAiProvider(provider);
    if (byokProvider && input.userId) {
      const apiKey = await getDecryptedUserAiKey(getServerSupabase(), input.userId, byokProvider);
      if (apiKey) return apiKey;
    }
  }

  if (!isPlatformEnabled()) {
    throw new Error(`No saved ${provider} API key was found and platform AI credits are not enabled.`);
  }

  return getPlatformKey(provider);
};

const callProvider = async (provider: AIProviderName, input: GenerateAIResponseInput) => {
  const apiKey = await resolveApiKey(provider, input);
  const options = {
    prompt: input.prompt,
    apiKey,
    model: input.model,
    systemInstruction: input.systemInstruction,
    responseMimeType: input.responseMimeType,
    maxOutputTokens: input.maxOutputTokens,
    temperature: input.temperature,
  };

  if (provider === "gemini") return generateWithGemini(options);
  if (provider === "openrouter") return generateWithOpenRouter(options);
  if (provider === "openai") return generateWithOpenAI(options);
  return generateWithNvidia(options);
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
