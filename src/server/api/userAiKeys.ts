import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  deleteUserAiKey,
  getDecryptedUserAiKey,
  listUserAiKeyMetadata,
  normalizeUserAiProvider,
  resolveAiKeyOwner,
  updateUserAiKeyTestStatus,
  upsertUserAiKey,
  type UserAiKeyProvider,
} from "../aiKeys";
import { AiCommandCenterHttpError, getServerSupabase } from "./aiCommandCenter";
import { getServerSupabaseEnv } from "../../lib/supabase/server";
import { hasEncryptionSecret, isPlausibleProviderKey } from "../../lib/envDiagnostics";

const getBody = (req: VercelRequest) =>
  req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};

const sendError = (res: VercelResponse, error: unknown) => {
  if (error instanceof AiCommandCenterHttpError) {
    return res.status(error.status).json({ error: error.message });
  }

  const message = error instanceof Error ? error.message : "AI key request failed.";
  const status =
    /Supabase admin env missing|Supabase env missing|encryption is not configured/i.test(message)
      ? 500
      : /Authentication required/i.test(message)
        ? 401
        : 400;
  return res.status(status).json({ error: message });
};

const adminEnvMissingResponse = (res: VercelResponse) =>
  res.status(503).json({
    error:
      "Supabase admin env missing. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY on the server to save encrypted AI keys.",
  });

const encryptionMissingResponse = (res: VercelResponse) =>
  res.status(503).json({
    error:
      "AI key storage is disabled because AI_KEYS_ENCRYPTION_SECRET is missing.",
  });

const validateSubmittedProviderKey = (provider: UserAiKeyProvider, apiKey: string) => {
  if (isPlausibleProviderKey(provider, apiKey)) return null;
  if (provider === "nvidia" && apiKey.startsWith("sk-or-")) {
    return "OpenRouter keys cannot be saved as NVIDIA keys. Use NVIDIA_API_KEY keys that start with nvapi-.";
  }
  return `No ${provider} key configured. The submitted key does not match the expected provider format.`;
};

async function testProviderKey(provider: UserAiKeyProvider, apiKey: string) {
  if (provider === "gemini") {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with ok." }] }],
          generationConfig: { maxOutputTokens: 8, temperature: 0 },
        }),
      },
    );
    return response.ok;
  }

  if (provider === "nvidia") {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.NVIDIA_MODEL || "google/gemma-3-27b-it",
        messages: [{ role: "user", content: "Reply with ok." }],
        max_tokens: 8,
        temperature: 0,
      }),
    });

    return response.ok;
  }

  const endpoint =
    provider === "openrouter"
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
  const model =
    provider === "openrouter"
      ? process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini"
      : process.env.OPENAI_MODEL || "gpt-4o-mini";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(provider === "openrouter" && process.env.APP_URL ? { "HTTP-Referer": process.env.APP_URL } : {}),
      ...(provider === "openrouter" ? { "X-Title": "Levelspace" } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with ok." }],
      max_tokens: 8,
      temperature: 0,
    }),
  });

  return response.ok;
}

export async function handleUserAiKeys(req: VercelRequest, res: VercelResponse) {
  try {
    const owner = await resolveAiKeyOwner(req, { requireAuthInProduction: true });
    const env = getServerSupabaseEnv();
    const encryptionConfigured = hasEncryptionSecret();

    if (!env.serviceRoleConfigured) {
      if (req.method === "GET") {
        return res.status(200).json({
          keys: [],
          adminConfigured: false,
          keyPersistenceEnabled: false,
          ownerMode: owner.devFallback ? "dev-admin" : "user",
          warning:
            "Supabase admin env missing. Saved AI keys are unavailable until SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is configured.",
        });
      }

      return adminEnvMissingResponse(res);
    }

    const supabase = getServerSupabase();

    if (req.method === "GET") {
      const keys = await listUserAiKeyMetadata(supabase, owner.ownerRef);
      return res.status(200).json({
        keys,
        adminConfigured: true,
        keyPersistenceEnabled: encryptionConfigured,
        ownerMode: owner.devFallback ? "dev-admin" : "user",
        warning: encryptionConfigured
          ? null
          : "AI key storage is disabled because AI_KEYS_ENCRYPTION_SECRET is missing.",
      });
    }

    if (req.method === "POST") {
      if (!encryptionConfigured) {
        return encryptionMissingResponse(res);
      }

      const body = getBody(req);
      const provider = normalizeUserAiProvider(body.provider);
      const rawKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

      if (!provider) return res.status(400).json({ error: "Unsupported AI provider." });
      if (!rawKey) return res.status(400).json({ error: "API key is required." });
      const keyFormatError = validateSubmittedProviderKey(provider, rawKey);
      if (keyFormatError) return res.status(400).json({ error: keyFormatError });

      const key = await upsertUserAiKey(supabase, owner, provider, rawKey);
      return res.status(200).json({ key });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function handleDeleteUserAiKey(req: VercelRequest, res: VercelResponse, providerValue: string | undefined) {
  try {
    if (req.method !== "DELETE") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const provider = normalizeUserAiProvider(providerValue);
    if (!provider) return res.status(400).json({ error: "Unsupported AI provider." });

    if (!getServerSupabaseEnv().serviceRoleConfigured) {
      return adminEnvMissingResponse(res);
    }
    if (!hasEncryptionSecret()) {
      return encryptionMissingResponse(res);
    }

    const owner = await resolveAiKeyOwner(req, { requireAuthInProduction: true });
    await deleteUserAiKey(getServerSupabase(), owner.ownerRef, provider);
    return res.status(200).json({ success: true, provider });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function handleTestUserAiKey(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = getBody(req);
    const provider = normalizeUserAiProvider(body.provider);
    if (!provider) return res.status(400).json({ error: "Unsupported AI provider." });

    const owner = await resolveAiKeyOwner(req, { requireAuthInProduction: true });
    const submittedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    if (submittedKey) {
      const keyFormatError = validateSubmittedProviderKey(provider, submittedKey);
      if (keyFormatError) {
        return res.status(400).json({ success: false, error: keyFormatError });
      }

      const success = await testProviderKey(provider, submittedKey);
      return res.status(200).json({
        success,
        error: success ? null : "Invalid API key.",
      });
    }

    if (!getServerSupabaseEnv().serviceRoleConfigured) {
      return adminEnvMissingResponse(res);
    }
    if (!hasEncryptionSecret()) {
      return encryptionMissingResponse(res);
    }

    const supabase = getServerSupabase();
    const apiKey = submittedKey || await getDecryptedUserAiKey(supabase, owner.ownerRef, provider);
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: "No API key saved for this provider. Add it once in AI Keys settings.",
      });
    }

    const success = await testProviderKey(provider, apiKey);
    if (!submittedKey) {
      await updateUserAiKeyTestStatus(supabase, owner.ownerRef, provider, success ? "passed" : "failed");
    }

    return res.status(200).json({
      success,
      error: success ? null : "Invalid API key.",
    });
  } catch (error) {
    return sendError(res, error);
  }
}
