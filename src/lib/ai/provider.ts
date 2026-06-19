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
  ownerRef?: string;
  requestApiKey?: string;
};

export type GenerateAIResponseResult = {
  text: string;
  provider: AIProviderName;
  model: string;
};

const MISSING_PROVIDER_MESSAGE = "No AI provider configured";

const normalizeProvider = (value: unknown): AIProviderName | null => {
  const provider = String(value || "").toLowerCase();
  if (provider === "gemini" || provider === "nvidia" || provider === "openrouter" || provider === "openai") return provider;
  return null;
};

const isTruthy = (value: unknown) => ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
const isProductionLike = () => process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

// DEV ONLY - remove after auth is implemented
export const isDevAdminAiKeyModeEnabled = () => {
  const explicitlyEnabled = isTruthy(process.env.ENABLE_DEV_ADMIN_AI_KEYS) || isTruthy(process.env.NEXT_PUBLIC_ENABLE_DEV_ADMIN_AI_KEYS);
  return explicitlyEnabled && !isProductionLike();
};

const getDevAdminKey = (provider: AIProviderName) => {
  if (!isDevAdminAiKeyModeEnabled()) return "";
  if (provider === "gemini") return process.env.DEV_ADMIN_GEMINI_API_KEY || "";
  if (provider === "nvidia") return process.env.DEV_ADMIN_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY || "";
  if (provider === "openrouter") return process.env.DEV_ADMIN_OPENROUTER_API_KEY || "";
  return "";
};

export const getDevAdminAiStatus = () => {
  const enabled = isDevAdminAiKeyModeEnabled();
  const providers = {
    gemini: Boolean(enabled && process.env.DEV_ADMIN_GEMINI_API_KEY),
    nvidia: Boolean(enabled && (process.env.DEV_ADMIN_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY)),
    openrouter: Boolean(enabled && process.env.DEV_ADMIN_OPENROUTER_API_KEY),
    openai: false,
  };

  return {
    enabled,
    providers,
    defaultProvider: normalizeProvider(process.env.DEV_ADMIN_AI_PROVIDER) || null,
  };
};

const isMissingProviderError = (error: unknown) =>
  error instanceof Error && /no ai provider configured|not configured|API_KEY|environment variables/i.test(error.message);

const cleanKey = (value: string | undefined) => String(value || "").trim().replace(/^["']|["']$/g, "");

const isPlausibleProviderKey = (provider: AIProviderName, key: string) => {
  if (!key) return false;
  if (provider === "gemini") return key.startsWith("AIza");
  if (provider === "openrouter") return key.startsWith("sk-or-");
  if (provider === "openai") return key.startsWith("sk-") && !key.startsWith("sk-or-");
  if (provider === "nvidia") return key.startsWith("nvapi-");
  return false;
};

const getPlatformKey = (provider: AIProviderName) => {
  const firstPlausible = (...values: Array<string | undefined>) =>
    values.map(cleanKey).find((key) => isPlausibleProviderKey(provider, key)) || "";

  if (provider === "gemini") {
    return firstPlausible(process.env.GEMINI_API_KEY, process.env.GEMINI_KEY_0, process.env.AI_API_KEY, process.env.VITE_AI_API_KEY);
  }
  if (provider === "openrouter") return firstPlausible(process.env.OPENROUTER_API_KEY);
  if (provider === "openai") return firstPlausible(process.env.OPENAI_API_KEY);
  if (provider === "nvidia") return firstPlausible(process.env.NVIDIA_API_KEY);
  return "";
};

const isPlatformEnabled = () => process.env.AI_PLATFORM_CREDITS_ENABLED !== "false";

export const getPlatformAiProviderStatus = () => ({
  gemini: Boolean(getPlatformKey("gemini")),
  nvidia: Boolean(getPlatformKey("nvidia")),
  openrouter: Boolean(getPlatformKey("openrouter")),
  openai: Boolean(getPlatformKey("openai")),
});

const providerOrder: AIProviderName[] = ["gemini", "nvidia", "openrouter", "openai"];

export const getConfiguredAIProvider = (): AIProviderName => {
  const devAdmin = getDevAdminAiStatus();
  const devAdminProvider = devAdmin.enabled ? normalizeProvider(process.env.DEV_ADMIN_AI_PROVIDER) : null;
  if (devAdminProvider && devAdmin.providers[devAdminProvider]) return devAdminProvider;

  const envProvider = normalizeProvider(process.env.AI_PROVIDER);
  const platformStatus = getPlatformAiProviderStatus();
  if (envProvider && platformStatus[envProvider]) return envProvider;

  return providerOrder.find((provider) => platformStatus[provider] || devAdmin.providers[provider]) || envProvider || "gemini";
};

const getFallbackProvider = (primary: AIProviderName) => {
  const configuredFallback = normalizeProvider(process.env.AI_FALLBACK_PROVIDER);
  const platformStatus = getPlatformAiProviderStatus();
  const devAdmin = getDevAdminAiStatus();
  if (configuredFallback && configuredFallback !== primary && (platformStatus[configuredFallback] || devAdmin.providers[configuredFallback])) {
    return configuredFallback;
  }

  return providerOrder.find((provider) => provider !== primary && (platformStatus[provider] || devAdmin.providers[provider])) || primary;
};

const resolveApiKey = async (provider: AIProviderName, input: GenerateAIResponseInput) => {
  const savedProvider = normalizeUserAiProvider(provider);
  const ownerRef = input.ownerRef || (input.userId ? `user:${input.userId}` : null);
  if (savedProvider && ownerRef) {
    const apiKey = await getDecryptedUserAiKey(getServerSupabase(), ownerRef, savedProvider);
    if (apiKey) return apiKey;
  }

  if (input.credentialMode === "byok") {
    // DEV ONLY - remove after auth is implemented
    if (!isProductionLike() && input.requestApiKey) return input.requestApiKey;

    if (savedProvider) {
      throw new Error(`No API key saved for this provider. Add it once in AI Keys settings.`);
    }
  }

  // DEV ONLY - remove after auth is implemented
  const devAdminKey = getDevAdminKey(provider);
  if (devAdminKey) return devAdminKey;

  if (!isPlatformEnabled()) {
    throw new Error(`No AI provider configured for ${provider}.`);
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
  const primary = input.provider || getConfiguredAIProvider();
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
