import { hasUsableSupabaseKey, isValidSupabaseUrl } from "./supabase/env";

export const SUPPORTED_AI_PROVIDERS = ["gemini", "openrouter", "openai", "nvidia"] as const;
export type SupportedAiProvider = (typeof SUPPORTED_AI_PROVIDERS)[number];

export type EnvDiagnostics = {
  aiProvider: SupportedAiProvider | null;
  fallbackProvider: SupportedAiProvider | null;
  fallbackEnabled: boolean;
  hasGeminiKey: boolean;
  hasOpenRouterKey: boolean;
  hasOpenAIKey: boolean;
  hasNvidiaKey: boolean;
  devAdminKeysEnabled: boolean;
  hasDevAdminProviderKey: boolean;
  hasEncryptionSecret: boolean;
  hasSupabaseClientConfig: boolean;
  hasSupabaseServerConfig: boolean;
  warnings: string[];
};

const PLACEHOLDER_VALUES = new Set([
  "",
  "MY_GEMINI_API_KEY",
  "MY_NVIDIA_API_KEY",
  "MY_OPENROUTER_API_KEY",
  "MY_OPENAI_API_KEY",
  "YOUR_SUPABASE_URL",
  "YOUR_SUPABASE_ANON_KEY",
  "YOUR_SUPABASE_SERVICE_ROLE_KEY",
  "your-anon-key",
]);

export const cleanEnvValue = (value: string | undefined) =>
  String(value || "").trim().replace(/^["']|["']$/g, "");

export const hasUsableSecret = (value: string | undefined) => {
  const cleaned = cleanEnvValue(value);
  return Boolean(cleaned && !PLACEHOLDER_VALUES.has(cleaned));
};

export const normalizeAiProvider = (value: unknown): SupportedAiProvider | null => {
  const provider = String(value || "").trim().toLowerCase();
  return SUPPORTED_AI_PROVIDERS.includes(provider as SupportedAiProvider)
    ? (provider as SupportedAiProvider)
    : null;
};

export const readBooleanEnv = (value: unknown, defaultValue = false) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
};

export const isProductionLike = () =>
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

export const isPlausibleProviderKey = (provider: SupportedAiProvider, keyValue: string | undefined) => {
  const key = cleanEnvValue(keyValue);
  if (!key) return false;
  if (provider === "gemini") return key.startsWith("AIza");
  if (provider === "openrouter") return key.startsWith("sk-or-");
  if (provider === "openai") return key.startsWith("sk-") && !key.startsWith("sk-or-");
  if (provider === "nvidia") return key.startsWith("nvapi-");
  return false;
};

export const getPlatformAiKey = (provider: SupportedAiProvider) => {
  if (provider === "gemini") return isPlausibleProviderKey("gemini", process.env.GEMINI_API_KEY) ? cleanEnvValue(process.env.GEMINI_API_KEY) : "";
  if (provider === "openrouter") return isPlausibleProviderKey("openrouter", process.env.OPENROUTER_API_KEY) ? cleanEnvValue(process.env.OPENROUTER_API_KEY) : "";
  if (provider === "openai") return isPlausibleProviderKey("openai", process.env.OPENAI_API_KEY) ? cleanEnvValue(process.env.OPENAI_API_KEY) : "";
  return isPlausibleProviderKey("nvidia", process.env.NVIDIA_API_KEY) ? cleanEnvValue(process.env.NVIDIA_API_KEY) : "";
};

export const getDevAdminAiKey = (provider: SupportedAiProvider) => {
  if (provider === "gemini") return isPlausibleProviderKey("gemini", process.env.DEV_ADMIN_GEMINI_API_KEY) ? cleanEnvValue(process.env.DEV_ADMIN_GEMINI_API_KEY) : "";
  if (provider === "openrouter") return isPlausibleProviderKey("openrouter", process.env.DEV_ADMIN_OPENROUTER_API_KEY) ? cleanEnvValue(process.env.DEV_ADMIN_OPENROUTER_API_KEY) : "";
  if (provider === "openai") return isPlausibleProviderKey("openai", process.env.DEV_ADMIN_OPENAI_API_KEY) ? cleanEnvValue(process.env.DEV_ADMIN_OPENAI_API_KEY) : "";
  return isPlausibleProviderKey("nvidia", process.env.DEV_ADMIN_NVIDIA_API_KEY) ? cleanEnvValue(process.env.DEV_ADMIN_NVIDIA_API_KEY) : "";
};

export const isDevAdminAiKeyModeEnabled = () =>
  readBooleanEnv(process.env.ENABLE_DEV_ADMIN_AI_KEYS, false) && !isProductionLike();

export const hasEncryptionSecret = () => cleanEnvValue(process.env.AI_KEYS_ENCRYPTION_SECRET).length >= 32;

export const getEnvDiagnostics = (): EnvDiagnostics => {
  const warnings: string[] = [];
  const aiProvider = normalizeAiProvider(process.env.AI_PROVIDER);
  const fallbackProvider = normalizeAiProvider(process.env.AI_FALLBACK_PROVIDER);
  const fallbackEnabled = readBooleanEnv(process.env.AI_FALLBACK_ENABLED, false);
  const devAdminKeysEnabled = isDevAdminAiKeyModeEnabled();
  const devAdminProvider = normalizeAiProvider(process.env.DEV_ADMIN_AI_PROVIDER);

  const hasGeminiKey = Boolean(getPlatformAiKey("gemini"));
  const hasOpenRouterKey = Boolean(getPlatformAiKey("openrouter"));
  const hasOpenAIKey = Boolean(getPlatformAiKey("openai"));
  const hasNvidiaKey = Boolean(getPlatformAiKey("nvidia"));
  const hasDevAdminGeminiKey = Boolean(devAdminKeysEnabled && getDevAdminAiKey("gemini"));
  const hasDevAdminOpenRouterKey = Boolean(devAdminKeysEnabled && getDevAdminAiKey("openrouter"));
  const hasDevAdminOpenAIKey = Boolean(devAdminKeysEnabled && getDevAdminAiKey("openai"));
  const hasDevAdminNvidiaKey = Boolean(devAdminKeysEnabled && getDevAdminAiKey("nvidia"));
  const providerKeys: Record<SupportedAiProvider, boolean> = {
    gemini: hasGeminiKey || hasDevAdminGeminiKey,
    openrouter: hasOpenRouterKey || hasDevAdminOpenRouterKey,
    openai: hasOpenAIKey || hasDevAdminOpenAIKey,
    nvidia: hasNvidiaKey || hasDevAdminNvidiaKey,
  };

  if (hasUsableSecret(process.env.AI_PROVIDER) && !aiProvider) {
    warnings.push("AI_PROVIDER must be one of gemini, openrouter, openai, nvidia.");
  }

  if (hasUsableSecret(process.env.AI_FALLBACK_PROVIDER) && !fallbackProvider) {
    warnings.push("AI_FALLBACK_PROVIDER must be a provider name, not an API key.");
  }

  if (fallbackEnabled && (!fallbackProvider || !providerKeys[fallbackProvider])) {
    warnings.push("AI_FALLBACK_ENABLED=true but AI_FALLBACK_PROVIDER has no matching platform API key.");
  }

  if (hasUsableSecret(process.env.NVIDIA_API_KEY) && !hasNvidiaKey) {
    warnings.push("NVIDIA_API_KEY is present but does not look like an NVIDIA key. OpenRouter sk-or-v1 keys are not valid NVIDIA keys.");
  }

  const hasDevAdminProviderKey = Boolean(devAdminKeysEnabled && devAdminProvider && getDevAdminAiKey(devAdminProvider));
  if (devAdminKeysEnabled && !devAdminProvider) {
    warnings.push("ENABLE_DEV_ADMIN_AI_KEYS=true but DEV_ADMIN_AI_PROVIDER is missing or invalid.");
  } else if (devAdminKeysEnabled && !hasDevAdminProviderKey) {
    warnings.push("Developer admin AI key mode is enabled, but the matching DEV_ADMIN_* key is missing.");
  }

  if (devAdminKeysEnabled && !readBooleanEnv(process.env.VITE_ENABLE_DEV_ADMIN_AI_KEYS, false)) {
    warnings.push("ENABLE_DEV_ADMIN_AI_KEYS=true but VITE_ENABLE_DEV_ADMIN_AI_KEYS is not true, so the frontend may hide dev/admin key mode.");
  }

  const encryptionConfigured = hasEncryptionSecret();
  if (!encryptionConfigured) {
    warnings.push("AI_KEYS_ENCRYPTION_SECRET is missing or too short. Saved AI key persistence is disabled.");
  }

  const hasSupabaseClientConfig =
    isValidSupabaseUrl(process.env.VITE_SUPABASE_URL) &&
    hasUsableSupabaseKey(process.env.VITE_SUPABASE_ANON_KEY);
  const hasSupabaseServerConfig =
    isValidSupabaseUrl(process.env.SUPABASE_URL) &&
    (hasUsableSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
      hasUsableSupabaseKey(process.env.SUPABASE_SECRET_KEY));

  if (!hasSupabaseClientConfig) {
    warnings.push("Supabase client config missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  if (!hasSupabaseServerConfig) {
    warnings.push("Supabase server config missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY.");
  }

  if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
    warnings.push("SUPABASE_URL is missing. Mirror VITE_SUPABASE_URL into SUPABASE_URL for server jobs.");
  }

  return {
    aiProvider,
    fallbackProvider,
    fallbackEnabled,
    hasGeminiKey,
    hasOpenRouterKey,
    hasOpenAIKey,
    hasNvidiaKey,
    devAdminKeysEnabled,
    hasDevAdminProviderKey,
    hasEncryptionSecret: encryptionConfigured,
    hasSupabaseClientConfig,
    hasSupabaseServerConfig,
    warnings,
  };
};

export const logStartupEnvDiagnostics = () => {
  const diagnostics = getEnvDiagnostics();
  const safeSummary = {
    aiProvider: diagnostics.aiProvider,
    fallbackProvider: diagnostics.fallbackProvider,
    fallbackEnabled: diagnostics.fallbackEnabled,
    hasGeminiKey: diagnostics.hasGeminiKey,
    hasOpenRouterKey: diagnostics.hasOpenRouterKey,
    hasOpenAIKey: diagnostics.hasOpenAIKey,
    hasNvidiaKey: diagnostics.hasNvidiaKey,
    devAdminKeysEnabled: diagnostics.devAdminKeysEnabled,
    hasDevAdminProviderKey: diagnostics.hasDevAdminProviderKey,
    hasEncryptionSecret: diagnostics.hasEncryptionSecret,
    hasSupabaseClientConfig: diagnostics.hasSupabaseClientConfig,
    hasSupabaseServerConfig: diagnostics.hasSupabaseServerConfig,
  };

  console.info("[env diagnostics]", safeSummary);
  for (const warning of diagnostics.warnings) {
    console.warn("[env diagnostics]", warning);
  }
};
