export type OpenAIGenerateOptions = {
  prompt: string;
  apiKey?: string;
  model?: string;
  systemInstruction?: string;
  responseMimeType?: string;
  maxOutputTokens?: number;
  temperature?: number;
};

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const getOpenAIApiKey = () => process.env.OPENAI_API_KEY || "";

export async function generateWithOpenAI(options: OpenAIGenerateOptions) {
  const apiKey = options.apiKey || getOpenAIApiKey();
  if (!apiKey) {
    throw new Error("OpenAI provider is not configured. Set OPENAI_API_KEY or save a BYOK key.");
  }

  const model = options.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
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
    throw new Error(`OpenAI request failed with status ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  const text = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("OpenAI returned an empty response.");

  return { text, provider: "openai" as const, model };
}
