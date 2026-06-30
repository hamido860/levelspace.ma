import { getPlatformAiKey } from "../../envDiagnostics";

export type OpenRouterGenerateOptions = {
  prompt: string;
  apiKey?: string;
  model?: string;
  systemInstruction?: string;
  responseMimeType?: string;
  maxOutputTokens?: number;
  temperature?: number;
};

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const getOpenRouterApiKey = () => getPlatformAiKey("openrouter");

export async function generateWithOpenRouter(options: OpenRouterGenerateOptions) {
  const apiKey = options.apiKey || getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("OpenRouter provider is not configured. Set OPENROUTER_API_KEY or save a BYOK key.");
  }

  const model = options.model || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(process.env.APP_URL ? { "HTTP-Referer": process.env.APP_URL } : {}),
      "X-Title": "Levelspace",
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(options.systemInstruction ? [{ role: "system", content: options.systemInstruction }] : []),
        { role: "user", content: options.prompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxOutputTokens || 4096,
      response_format: options.responseMimeType === "application/json" ? { type: "json_object" } : undefined,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter request failed with status ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  const text = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("OpenRouter returned an empty response.");

  return { text, provider: "openrouter" as const, model };
}
