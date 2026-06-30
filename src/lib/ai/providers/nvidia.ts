import { getPlatformAiKey } from "../../envDiagnostics";

export type NvidiaGenerateOptions = {
  prompt: string;
  apiKey?: string;
  model?: string;
  systemInstruction?: string;
  responseMimeType?: string;
  maxOutputTokens?: number;
  temperature?: number;
};

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";
const NVIDIA_FALLBACK_MODELS = [
  "meta/llama-3.1-70b-instruct",
  "google/gemma-3-27b-it",
];

const getNvidiaApiKey = () => getPlatformAiKey("nvidia");

async function tryNvidiaRequest(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: NvidiaGenerateOptions,
): Promise<{ text: string; model: string } | null> {
  const response = await fetch(NVIDIA_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxOutputTokens || 4096,
      stream: false,
      response_format: options.responseMimeType === "application/json" ? { type: "json_object" } : undefined,
    }),
  });

  if (!response.ok) {
    const body = await response.text();

    // 404 = model not found / deprecated — try fallback models
    if (response.status === 404) {
      console.warn(`[NVIDIA] Model "${model}" returned 404 (not found or deprecated). Body: ${body.slice(0, 200)}`);
      return null;
    }

    // 429 = rate limited
    if (response.status === 429) {
      throw new Error(`NVIDIA quota exceeded (429). ${body.slice(0, 300)}`);
    }

    // 401/403 = auth error
    if (response.status === 401 || response.status === 403) {
      throw new Error(`NVIDIA authentication failed (${response.status}). Check your NVIDIA_API_KEY.`);
    }

    throw new Error(`NVIDIA request failed with status ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  const text = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!text) return null;

  return { text, model };
}

export async function generateWithNvidia(options: NvidiaGenerateOptions) {
  const apiKey = options.apiKey || getNvidiaApiKey();
  if (!apiKey || apiKey === "MY_NVIDIA_API_KEY") {
    throw new Error("NVIDIA provider is not configured. Set NVIDIA_API_KEY in environment variables.");
  }

  const primaryModel = options.model || process.env.NVIDIA_MODEL || DEFAULT_NVIDIA_MODEL;
  const messages = [
    ...(options.systemInstruction ? [{ role: "system", content: options.systemInstruction }] : []),
    { role: "user", content: options.prompt },
  ];

  // Try primary model first
  const primaryResult = await tryNvidiaRequest(apiKey, primaryModel, messages, options);
  if (primaryResult) {
    return { text: primaryResult.text, provider: "nvidia" as const, model: primaryResult.model };
  }

  // If primary model returns 404, try fallback models
  for (const fallbackModel of NVIDIA_FALLBACK_MODELS) {
    if (fallbackModel === primaryModel) continue;
    console.warn(`[NVIDIA] Trying fallback model: ${fallbackModel}`);
    try {
      const fallbackResult = await tryNvidiaRequest(apiKey, fallbackModel, messages, options);
      if (fallbackResult) {
        return { text: fallbackResult.text, provider: "nvidia" as const, model: fallbackResult.model };
      }
    } catch (fallbackErr) {
      console.warn(`[NVIDIA] Fallback model "${fallbackModel}" also failed:`, fallbackErr);
    }
  }

  throw new Error(`NVIDIA: All models failed (primary: ${primaryModel}, fallbacks: ${NVIDIA_FALLBACK_MODELS.join(", ")}). The models may be temporarily unavailable.`);
}
