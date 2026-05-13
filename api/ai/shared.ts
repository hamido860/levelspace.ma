import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateAIResponse, generateContextualExplanation, generateEmbedding, generateLessonBlocks } from "../../src/lib/ai/provider";

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

const readConfig = (body: Record<string, any>) => body.config && typeof body.config === "object" ? body.config : {};

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
    const result = await generateAIResponse({
      prompt,
      provider: body.provider,
      model: typeof body.model === "string" ? body.model : undefined,
      systemInstruction: typeof config.systemInstruction === "string" ? config.systemInstruction : undefined,
      responseMimeType: typeof config.responseMimeType === "string" ? config.responseMimeType : undefined,
      maxOutputTokens: typeof config.maxOutputTokens === "number" ? config.maxOutputTokens : undefined,
      temperature: typeof config.temperature === "number" ? config.temperature : undefined,
      fallbackEnabled: body.fallbackEnabled,
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI request failed.";
    return res.status(message.includes("not configured") ? 503 : 502).json({ error: message });
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
    const result = await generateContextualExplanation({
      prompt,
      provider: body.provider,
      model: body.model,
      maxOutputTokens: 1200,
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI explanation failed.";
    return res.status(message.includes("not configured") ? 503 : 502).json({ error: message });
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
    const result = await generateLessonBlocks({
      prompt,
      provider: body.provider,
      model: body.model,
      maxOutputTokens: 4096,
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI lesson block generation failed.";
    return res.status(message.includes("not configured") ? 503 : 502).json({ error: message });
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
    return res.status(message.includes("not configured") ? 503 : 502).json({ error: message });
  }
}
