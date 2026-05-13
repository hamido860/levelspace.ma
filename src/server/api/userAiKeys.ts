import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  deleteUserAiKey,
  getDecryptedUserAiKey,
  listUserAiKeyMetadata,
  normalizeUserAiProvider,
  upsertUserAiKey,
  type UserAiKeyProvider,
} from "../aiKeys";
import { AiCommandCenterHttpError, getServerSupabase, requireAuthenticatedUser } from "./aiCommandCenter";

const getBody = (req: VercelRequest) =>
  req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};

const sendError = (res: VercelResponse, error: unknown) => {
  if (error instanceof AiCommandCenterHttpError) {
    return res.status(error.status).json({ error: error.message });
  }

  const message = error instanceof Error ? error.message : "AI key request failed.";
  const status = message === "AI key encryption is not configured." ? 500 : 400;
  return res.status(status).json({ error: message });
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
    const user = await requireAuthenticatedUser(req);
    const supabase = getServerSupabase();

    if (req.method === "GET") {
      const keys = await listUserAiKeyMetadata(supabase, user.id);
      return res.status(200).json({ keys });
    }

    if (req.method === "POST") {
      const body = getBody(req);
      const provider = normalizeUserAiProvider(body.provider);
      const rawKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

      if (!provider) return res.status(400).json({ error: "Unsupported AI provider." });
      if (!rawKey) return res.status(400).json({ error: "API key is required." });

      const key = await upsertUserAiKey(
        supabase,
        user.id,
        provider,
        rawKey,
        typeof body.label === "string" ? body.label : null,
      );
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

    const user = await requireAuthenticatedUser(req);
    await deleteUserAiKey(getServerSupabase(), user.id, provider);
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

    const provider = normalizeUserAiProvider(getBody(req).provider);
    if (!provider) return res.status(400).json({ error: "Unsupported AI provider." });

    const user = await requireAuthenticatedUser(req);
    const apiKey = await getDecryptedUserAiKey(getServerSupabase(), user.id, provider);
    if (!apiKey) {
      return res.status(404).json({ success: false, error: "No saved key for this provider." });
    }

    const success = await testProviderKey(provider, apiKey);
    return res.status(200).json({
      success,
      error: success ? null : "Provider rejected the saved key.",
    });
  } catch (error) {
    return sendError(res, error);
  }
}
