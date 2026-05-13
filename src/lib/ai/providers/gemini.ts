export type GeminiGenerateOptions = {
  prompt: string;
  model?: string;
  systemInstruction?: string;
  responseMimeType?: string;
  maxOutputTokens?: number;
  temperature?: number;
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const getGeminiApiKey = () =>
  process.env.GEMINI_API_KEY ||
  process.env.GEMINI_KEY_0 ||
  "";

export async function generateWithGemini(options: GeminiGenerateOptions) {
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("Gemini provider is not configured. Set GEMINI_API_KEY in environment variables.");
  }

  const model = options.model || process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(`${GEMINI_API_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: options.prompt }],
        },
      ],
      systemInstruction: options.systemInstruction
        ? { parts: [{ text: options.systemInstruction }] }
        : undefined,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxOutputTokens,
        responseMimeType: options.responseMimeType,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini request failed with status ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return {
    text,
    provider: "gemini" as const,
    model,
  };
}

export async function embedWithGemini(text: string) {
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("Gemini provider is not configured. Set GEMINI_API_KEY in environment variables.");
  }

  const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2-preview";
  const response = await fetch(`${GEMINI_API_URL}/${model}:embedContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini embedding failed with status ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values)) {
    throw new Error("Gemini returned no embedding values.");
  }

  return { embedding: values as number[], provider: "gemini" as const, model };
}
