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
const DEFAULT_NVIDIA_MODEL = "google/gemma-3-27b-it";

const getNvidiaApiKey = () => getPlatformAiKey("nvidia");

export async function generateWithNvidia(options: NvidiaGenerateOptions) {
  const apiKey = options.apiKey || getNvidiaApiKey();
  if (!apiKey || apiKey === "MY_NVIDIA_API_KEY") {
    throw new Error("NVIDIA provider is not configured. Set NVIDIA_API_KEY in environment variables.");
  }

  const model = options.model || process.env.NVIDIA_MODEL || DEFAULT_NVIDIA_MODEL;
  const messages = [
    ...(options.systemInstruction ? [{ role: "system", content: options.systemInstruction }] : []),
    { role: "user", content: options.prompt },
  ];

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
    throw new Error(`NVIDIA request failed with status ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  const text = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!text) {
    throw new Error("NVIDIA returned an empty response.");
  }

  return {
    text,
    provider: "nvidia" as const,
    model,
  };
}
