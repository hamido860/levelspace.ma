import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  generateAIResponse,
  generateContextualExplanation,
  generateEmbedding,
  generateLessonBlocks,
  getConfiguredAIProvider,
  getDevAdminAiStatus,
  getPlatformAiProviderStatus,
} from "../../lib/ai/provider";
import { getEnvDiagnostics } from "../../lib/envDiagnostics";
import { getDevAdminOwnerRef, listUserAiKeyMetadata, resolveAiKeyOwner } from "../aiKeys";
import { getServerSupabase, requireAuthenticatedUser } from "./aiCommandCenter";
import { getServerSupabaseEnv } from "../../lib/supabase/server";

type ApiRequest = VercelRequest;
type ApiResponse = VercelResponse;

const getBody = (req: ApiRequest) =>
  req.body && typeof req.body === "object" ? req.body : {};

const readPrompt = (body: Record<string, any>) => {
  if (typeof body.prompt === "string") return body.prompt;
  if (typeof body.contents === "string") return body.contents;
  if (Array.isArray(body.contents)) return JSON.stringify(body.contents);
  return "";
};

const readConfig = (body: Record<string, any>) =>
  body.config && typeof body.config === "object" ? body.config : {};

const isConfigurationError = (message: string) =>
  /no ai provider configured|not configured/i.test(message);

const hasBearerToken = (req: ApiRequest) => {
  const header = req.headers.authorization || req.headers.Authorization;
  return typeof header === "string" && /^Bearer\s+.+/i.test(header);
};

const isProductionLike = () => process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

const resolveCredentialContext = async (req: ApiRequest, body: Record<string, any>) => {
  const wantsByok = body.credentialMode === "byok";
  if (wantsByok && !isProductionLike() && typeof body.requestApiKey === "string" && body.requestApiKey.trim()) {
    return { credentialMode: "byok" as const, userId: undefined, ownerRef: undefined };
  }

  if (hasBearerToken(req)) {
    const user = await requireAuthenticatedUser(req);
    return { credentialMode: wantsByok ? "byok" as const : "platform" as const, userId: user.id, ownerRef: `user:${user.id}` };
  }

  if (wantsByok) {
    const owner = await resolveAiKeyOwner(req);
    return { credentialMode: "byok" as const, userId: owner.userId || undefined, ownerRef: owner.ownerRef };
  }

  return { credentialMode: "platform" as const, userId: undefined, ownerRef: undefined };
};

export async function handleAIStatus(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const platformProviders = getPlatformAiProviderStatus();
  const devAdmin = getDevAdminAiStatus();
  const configuredProvider = getConfiguredAIProvider();
  const diagnostics = getEnvDiagnostics();
  const savedDevAdminKeys = {
    gemini: false,
    openrouter: false,
    openai: false,
    nvidia: false,
  };

  if (diagnostics.devAdminKeysEnabled && getServerSupabaseEnv().serviceRoleConfigured) {
    try {
      const metadata = await listUserAiKeyMetadata(getServerSupabase(), getDevAdminOwnerRef());
      for (const key of metadata) {
        savedDevAdminKeys[key.provider] = Boolean(key.is_active && key.key_preview);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load saved dev/admin AI key metadata.";
      console.warn("[AI Status] Saved dev/admin key metadata unavailable:", message);
    }
  }
  const statusDiagnostics = {
    ...diagnostics,
    warnings:
      diagnostics.fallbackEnabled &&
      diagnostics.fallbackProvider &&
      savedDevAdminKeys[diagnostics.fallbackProvider]
        ? diagnostics.warnings.filter((warning) => !warning.includes("AI_FALLBACK_ENABLED=true"))
        : diagnostics.warnings,
  };

  return res.status(200).json({
    configured:
      diagnostics.hasGeminiKey ||
      diagnostics.hasNvidiaKey ||
      diagnostics.hasOpenRouterKey ||
      diagnostics.hasOpenAIKey ||
      Object.values(devAdmin.providers).some(Boolean) ||
      Object.values(savedDevAdminKeys).some(Boolean),
    providers: {
      gemini: platformProviders.gemini,
      nvidia: platformProviders.nvidia,
      openrouter: platformProviders.openrouter,
      openai: platformProviders.openai,
    },
    devAdmin,
    savedDevAdminKeys,
    defaultProvider: configuredProvider,
    fallbackProvider: diagnostics.fallbackProvider,
    fallbackEnabled: diagnostics.fallbackEnabled,
    platformCreditsEnabled: process.env.AI_PLATFORM_CREDITS_ENABLED !== "false",
    diagnostics: statusDiagnostics,
    models: {
      gemini: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      nvidia: process.env.NVIDIA_MODEL || "google/gemma-3-27b-it",
      openrouter: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
      openai: process.env.OPENAI_MODEL || "gpt-4o-mini",
    },
  });
}

export async function handleAIGenerate(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = getBody(req);
  const config = readConfig(body);
  const prompt = readPrompt(body);
  if (!prompt.trim()) {
    return res.status(400).json({ error: "prompt or contents is required." });
  }

  try {
    const credentials = await resolveCredentialContext(req, body);
    const result = await generateAIResponse({
      prompt,
      provider: body.provider,
      model: typeof body.model === "string" ? body.model : undefined,
      systemInstruction: typeof config.systemInstruction === "string" ? config.systemInstruction : undefined,
      responseMimeType: typeof config.responseMimeType === "string" ? config.responseMimeType : undefined,
      maxOutputTokens: typeof config.maxOutputTokens === "number" ? config.maxOutputTokens : undefined,
      temperature: typeof config.temperature === "number" ? config.temperature : undefined,
      fallbackEnabled: body.fallbackEnabled,
      credentialMode: credentials.credentialMode,
      userId: credentials.userId,
      ownerRef: credentials.ownerRef,
      requestApiKey: typeof body.requestApiKey === "string" && !isProductionLike() ? body.requestApiKey : undefined,
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI request failed.";
    return res.status(isConfigurationError(message) ? 503 : 502).json({ error: message });
  }
}

export async function handleAIExplain(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = getBody(req);
  const selectedText = String(body.selectedText || "").trim();
  if (!selectedText) {
    return res.status(400).json({ error: "selectedText is required." });
  }

  const prompt = `Explain the selected lesson text using the provided context.

Selected text: ${selectedText}
Mode: ${body.mode || "contextual_explanation"}
Lesson title: ${body.lessonTitle || ""}
Subject: ${body.lessonSubject || ""}
Topic: ${body.lessonTopic || ""}
Surrounding sentence: ${body.surroundingSentence || ""}
Surrounding paragraph: ${body.surroundingParagraph || ""}

Return a concise student-friendly answer.`;

  try {
    const credentials = await resolveCredentialContext(req, body);
    const result = await generateContextualExplanation({
      prompt,
      provider: body.provider,
      model: body.model,
      maxOutputTokens: 1200,
      credentialMode: credentials.credentialMode,
      userId: credentials.userId,
      ownerRef: credentials.ownerRef,
      requestApiKey: typeof body.requestApiKey === "string" && !isProductionLike() ? body.requestApiKey : undefined,
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI explanation failed.";
    return res.status(isConfigurationError(message) ? 503 : 502).json({ error: message });
  }
}

export async function handleAILessonBlocks(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = getBody(req);
  const prompt = readPrompt(body);
  if (!prompt.trim()) {
    return res.status(400).json({ error: "prompt or contents is required." });
  }

  try {
    const credentials = await resolveCredentialContext(req, body);
    const result = await generateLessonBlocks({
      prompt,
      provider: body.provider,
      model: body.model,
      maxOutputTokens: 4096,
      credentialMode: credentials.credentialMode,
      userId: credentials.userId,
      ownerRef: credentials.ownerRef,
      requestApiKey: typeof body.requestApiKey === "string" && !isProductionLike() ? body.requestApiKey : undefined,
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI lesson block generation failed.";
    return res.status(isConfigurationError(message) ? 503 : 502).json({ error: message });
  }
}

export async function handleAIEmbed(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = getBody(req);
  const text = String(body.text || body.contents || "").trim();
  if (!text) {
    return res.status(400).json({ error: "text is required." });
  }

  try {
    const result = await generateEmbedding({ text });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI embedding failed.";
    return res.status(isConfigurationError(message) ? 503 : 502).json({ error: message });
  }
}
