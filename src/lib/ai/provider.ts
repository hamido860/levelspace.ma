import { embedWithGemini, generateWithGemini } from "./providers/gemini";
import { generateWithNvidia } from "./providers/nvidia";
import { generateWithOpenAI } from "./providers/openai";
import { generateWithOpenRouter } from "./providers/openrouter";
import { getDecryptedUserAiKey, getDevAdminOwnerRef, normalizeUserAiProvider } from "../../server/aiKeys";
import { getServerSupabase } from "../../server/api/aiCommandCenter";
import {
  getDevAdminAiKey,
  getEnvDiagnostics,
  getPlatformAiKey,
  isDevAdminAiKeyModeEnabled,
  isProductionLike,
  normalizeAiProvider,
  readBooleanEnv,
  type SupportedAiProvider,
} from "../envDiagnostics";

export type AIProviderName = SupportedAiProvider;
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

export const getDevAdminAiStatus = () => {
  const enabled = isDevAdminAiKeyModeEnabled();
  const providers = {
    gemini: Boolean(enabled && getDevAdminAiKey("gemini")),
    nvidia: Boolean(enabled && getDevAdminAiKey("nvidia")),
    openrouter: Boolean(enabled && getDevAdminAiKey("openrouter")),
    openai: Boolean(enabled && getDevAdminAiKey("openai")),
  };

  return {
    enabled,
    providers,
    defaultProvider: normalizeAiProvider(process.env.DEV_ADMIN_AI_PROVIDER) || null,
  };
};

const isMissingProviderError = (error: unknown) =>
  error instanceof Error && /no ai provider configured|not configured|API_KEY|environment variables/i.test(error.message);

const isPlatformEnabled = () => process.env.AI_PLATFORM_CREDITS_ENABLED !== "false";

const tryGetSavedAiKey = async (ownerRef: string, provider: AIProviderName) => {
  const savedProvider = normalizeUserAiProvider(provider);
  if (!savedProvider) return null;

  try {
    return await getDecryptedUserAiKey(getServerSupabase(), ownerRef, savedProvider);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[AI Provider] Saved ${provider} key unavailable:`, message);
    return null;
  }
};

export const getPlatformAiProviderStatus = () => ({
  gemini: Boolean(getPlatformAiKey("gemini")),
  nvidia: Boolean(getPlatformAiKey("nvidia")),
  openrouter: Boolean(getPlatformAiKey("openrouter")),
  openai: Boolean(getPlatformAiKey("openai")),
});

const providerOrder: AIProviderName[] = ["gemini", "openrouter", "openai", "nvidia"];

export const getConfiguredAIProvider = (): AIProviderName => {
  const devAdmin = getDevAdminAiStatus();
  const devAdminProvider = devAdmin.enabled ? normalizeAiProvider(process.env.DEV_ADMIN_AI_PROVIDER) : null;
  if (devAdminProvider && devAdmin.providers[devAdminProvider]) return devAdminProvider;

  const envProvider = normalizeAiProvider(process.env.AI_PROVIDER);
  const platformStatus = getPlatformAiProviderStatus();
  if (envProvider && platformStatus[envProvider]) return envProvider;

  return providerOrder.find((provider) => platformStatus[provider] || devAdmin.providers[provider]) || envProvider || "gemini";
};

const getFallbackProvider = (primary: AIProviderName) => {
  const configuredFallback = normalizeAiProvider(process.env.AI_FALLBACK_PROVIDER);
  if (configuredFallback && configuredFallback !== primary) {
    return configuredFallback;
  }

  return primary;
};

const resolveApiKey = async (provider: AIProviderName, input: GenerateAIResponseInput) => {
  const savedProvider = normalizeUserAiProvider(provider);
  const ownerRef = input.ownerRef || (input.userId ? `user:${input.userId}` : null);
  if (savedProvider && input.userId && ownerRef) {
    const apiKey = await tryGetSavedAiKey(ownerRef, provider);
    if (apiKey) return apiKey;
  }

  // TODO(auth): remove dev/admin key exception after authenticated per-user key ownership is implemented.
  // TODO(security): review key storage before production.
  if (isDevAdminAiKeyModeEnabled()) {
    const savedDevAdminKey = await tryGetSavedAiKey(getDevAdminOwnerRef(), provider);
    if (savedDevAdminKey) return savedDevAdminKey;
  }

  if (input.credentialMode === "byok") {
    // DEV ONLY - remove after auth is implemented
    if (!isProductionLike() && input.requestApiKey) return input.requestApiKey;

    if (savedProvider) {
      throw new Error(`No API key configured for this provider.`);
    }
  }

  const devAdminKey = isDevAdminAiKeyModeEnabled() ? getDevAdminAiKey(provider) : "";
  if (devAdminKey) return devAdminKey;

  if (!isPlatformEnabled()) {
    throw new Error(`No API key configured for this provider.`);
  }

  const platformKey = getPlatformAiKey(provider);
  if (platformKey) return platformKey;

  throw new Error(`No API key configured for this provider.`);
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
  const primary = normalizeAiProvider(input.provider) || getConfiguredAIProvider();
  const fallback = getFallbackProvider(primary);
  const fallbackEnabled = input.fallbackEnabled ?? readBooleanEnv(process.env.AI_FALLBACK_ENABLED, false);
  const errors: string[] = [];

  const diagnostics = getEnvDiagnostics();
  if (diagnostics.fallbackEnabled && diagnostics.warnings.some((warning) => warning.includes("AI_FALLBACK_ENABLED=true"))) {
    console.warn("[AI Provider]", diagnostics.warnings.find((warning) => warning.includes("AI_FALLBACK_ENABLED=true")));
  }

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
