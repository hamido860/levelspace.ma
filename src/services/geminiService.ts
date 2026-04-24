import { GoogleGenAI, Type } from "@google/genai";
import { jsonrepair } from "jsonrepair";
import { moroccanAcademicDb } from "../data/moroccan_academic_db";
import { toast } from "sonner";
import { db } from "../db/db";
import { searchContextForGeneration } from "./ragService";
import { transformersService } from "./transformersService";
import { mcpClient } from "./mcpClient";

export const getCustomApiKey = () =>
  localStorage.getItem("CUSTOM_GEMINI_API_KEY") || "";

export const getEffectiveApiKey = () => getCustomApiKey() || process.env.GEMINI_API_KEY || "";

export const getNvidiaApiKey = () =>
  localStorage.getItem("CUSTOM_NVIDIA_API_KEY") || (import.meta as any).env?.NVIDIA_API_KEY || "";

export const setNvidiaApiKey = (key: string) => {
  if (key) {
    localStorage.setItem("CUSTOM_NVIDIA_API_KEY", key);
  } else {
    localStorage.removeItem("CUSTOM_NVIDIA_API_KEY");
  }
};

export const NVIDIA_MODEL = "google/gemma-3-27b-it";

export async function callNvidiaAPI(params: {
  prompt: string;
  isJson?: boolean;
  temperature?: number;
  maxTokens?: number;
}): Promise<string | null> {
  const apiKey = getNvidiaApiKey();
  if (!apiKey) return null;

  const { prompt, isJson = false, temperature = 0.7, maxTokens = 4096 } = params;

  const body: any = {
    model: NVIDIA_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };

  if (isJson) {
    body.response_format = { type: "json_object" };
    // Reinforce JSON output in prompt for Gemma
    body.messages[0].content = prompt + "\n\nRespond with valid JSON only.";
  }

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`NVIDIA API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

let currentApiKey = getEffectiveApiKey();
// Provide a fallback string so the SDK doesn't throw an error immediately on boot if hosted outside AI Studio without a key
export let ai = new GoogleGenAI({ apiKey: currentApiKey || "missing_api_key" });

export const setCustomApiKey = (key: string) => {
  if (key) {
    localStorage.setItem("CUSTOM_GEMINI_API_KEY", key);
  } else {
    localStorage.removeItem("CUSTOM_GEMINI_API_KEY");
  }
  currentApiKey = getEffectiveApiKey();
  ai = new GoogleGenAI({ apiKey: currentApiKey || "missing_api_key" });
};

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export class ServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceUnavailableError";
  }
}

export interface CurriculumAuditResult {
  isValid: boolean;
  explanation: string;
  suggestedSubjects: string[];
}

export async function auditCurriculumConfig(
  country: string,
  grade: string,
  section: string,
  track: string,
  subject: string,
  referenceUrls?: string[]
): Promise<CurriculumAuditResult | null> {
  if (!currentApiKey) {
    console.error("Gemini API key is missing. Please configure it in the Secrets panel.");
    return null;
  }

  let urlContexts = "";
  if (referenceUrls && referenceUrls.length > 0) {
    urlContexts = await fetchAllUrlContexts(referenceUrls);
  }

  const prompt = `You are an expert curriculum auditor for the educational system of ${country}.
Your task is to verify if the following curriculum configuration is valid in the real-world educational system of ${country}.

Configuration to audit:
- Country: ${country}
- Grade/Level: ${grade}
- Section: ${section || 'N/A'}
- Track: ${track || 'N/A'}
- Subject: ${subject}
${referenceUrls && referenceUrls.length > 0 ? `- Reference URLs: ${referenceUrls.join(', ')}` : ''}
${urlContexts ? `\nExtracted content from Reference URLs:\n${urlContexts}\n` : ''}

Analyze this configuration. For example, in the Moroccan system, the "Littéraire" track in "2ème année Bac" does NOT have "Mathématiques" as a primary subject (or it might be completely absent depending on the specific reform, but generally it's a major mismatch).

Respond strictly in JSON format with the following schema:
{
  "isValid": boolean, // true if the subject is legitimately taught in this specific track/grade, false if it's a mismatch.
  "explanation": "string", // A brief explanation of why it is valid or invalid. If invalid, explain what subjects are actually taught in this track.
  "suggestedSubjects": ["string"] // A list of 3-5 subjects that ARE actually taught in this specific track/grade.
}`;

  try {
    const config: any = {
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isValid: { type: Type.BOOLEAN },
          explanation: { type: Type.STRING },
          suggestedSubjects: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["isValid", "explanation", "suggestedSubjects"]
      }
    };

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: config
    });

    const text = response.text;
    if (!text) return null;

    try {
      const parsed = safeJsonParse(text);
      return parsed as CurriculumAuditResult;
    } catch (e) {
      console.error("Failed to parse audit response:", e);
      return null;
    }
  } catch (error) {
    handleApiError(error, "auditCurriculumConfig");
    return null;
  }
}

export const handleApiError = (error: any, context: string) => {
  console.error(`Error in ${context}:`, error);
  const errorMessage = error?.message || String(error);

  if (
    errorMessage.includes("429") ||
    errorMessage.includes("RESOURCE_EXHAUSTED") ||
    errorMessage.includes("quota")
  ) {
    toast.error("AI Quota Exceeded", {
      description:
        "You've reached the free tier limit. Please add your own API key in Settings.",
      duration: 5000,
    });
    throw new QuotaExceededError("AI Quota Exceeded");
  } else if (
    errorMessage.includes("503") ||
    errorMessage.includes("UNAVAILABLE")
  ) {
    toast.error("AI Service Unavailable", {
      description:
        "The AI model is currently experiencing high demand. Please try again later.",
      duration: 5000,
    });
    throw new ServiceUnavailableError("AI Service Unavailable");
  }

  return false;
};

// --- AI Response Pipeline ---

// 1. Cache (Free & Persistent)
const responseCache = {
  get: async (key: string): Promise<string | null> => {
    try {
      const cached = await db.aiCache.get(key);
      if (cached) {
        // Optional: Implement TTL (Time-To-Live) here if needed
        return cached.response;
      }
    } catch (err) {
      console.warn("Failed to read from AI cache:", err);
    }
    return null;
  },
  set: async (key: string, response: string): Promise<void> => {
    try {
      await db.aiCache.put({
        key,
        response,
        createdAt: Date.now()
      });
    } catch (err) {
      console.warn("Failed to write to AI cache:", err);
    }
  },
  has: async (key: string): Promise<boolean> => {
    const cached = await db.aiCache.get(key);
    return !!cached;
  }
};

export function getCacheKey(operation: string, ...args: any[]): string {
  return `${operation}:${JSON.stringify(args)}`;
}

// 2. Simple Task Rules (Nearly Free)
const SIMPLE_GREETINGS = new Set([
  "hi",
  "hello",
  "hey",
  "greetings",
  "sup",
  "bonjour",
  "salut",
  "مرحبا",
  "اهلا",
]);
const SIMPLE_THANKS = new Set([
  "thanks",
  "thank you",
  "thx",
  "ty",
  "ok",
  "okay",
  "got it",
  "understood",
  "merci",
  "شكرا",
  "حسنا",
]);

export function handleSimpleTask(message: string): string | null {
  const cleanMsg = message
    .trim()
    .toLowerCase()
    .replace(/[^\w\sأ-ي]/g, "");
  if (SIMPLE_GREETINGS.has(cleanMsg)) {
    return "Hello! How can I help you with your lesson today?";
  }
  if (SIMPLE_THANKS.has(cleanMsg)) {
    return "You're welcome! Let me know if you have any other questions.";
  }
  return null;
}

// 3. Model Routing (Small vs Big Model)
export function determineModel(
  message: string,
  contextLength: number = 0,
): string {
  const complexKeywords = [
    "explain",
    "why",
    "how",
    "proof",
    "theorem",
    "calculate",
    "solve",
    "complex",
    "detailed",
    "analyze",
    "compare",
    "evaluate",
    "derive",
    "pourquoi",
    "comment",
    "expliquer",
    "prouver",
    "calculer",
    "résoudre",
    "لماذا",
    "كيف",
    "اشرح",
    "برهن",
    "احسب",
    "حل",
  ];

  const cleanMsg = message.toLowerCase();
  const hasComplexKeyword = complexKeywords.some((kw) => cleanMsg.includes(kw));
  const isLongMessage = message.length > 150;
  const isLongContext = contextLength > 2000;

  // Use big model for complex reasoning
  if (hasComplexKeyword || isLongMessage || isLongContext) {
    return "gemini-3.1-pro-preview";
  }

  // Use standard flash model for simple queries
  return "gemini-3-flash-preview";
}

/**
 * Cleans a string that might contain markdown code blocks or other common AI artifacts.
 */
export function cleanJsonString(text: string): string {
  if (!text) return "";
  
  let cleaned = text.trim();
  
  // Remove markdown code blocks if present
  if (cleaned.includes("```")) {
    // Try to find the first json block
    const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      cleaned = jsonMatch[1].trim();
    } else {
      // Fallback: just remove all backticks and any language identifier
      cleaned = cleaned.replace(/```(?:json|javascript|typescript|text)?/gi, "").replace(/```/g, "").trim();
    }
  }

  // Find the first '{' or '['
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  
  let start = -1;
  let end = -1;
  let type: 'object' | 'array' | null = null;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    type = 'object';
  } else if (firstBracket !== -1) {
    start = firstBracket;
    type = 'array';
  }

  if (start !== -1) {
    // Robust brace matching to find the end of the FIRST valid JSON object/array
    let braceCount = 0;
    let inString = false;
    let escape = false;
    const openChar = type === 'object' ? '{' : '[';
    const closeChar = type === 'object' ? '}' : ']';

    for (let i = start; i < cleaned.length; i++) {
      const char = cleaned[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === openChar) braceCount++;
        else if (char === closeChar) {
          braceCount--;
          if (braceCount === 0) {
            end = i;
            break;
          }
        }
      }
    }

    // If we didn't find a matching closing brace, fall back to last index
    if (end === -1) {
      end = type === 'object' ? cleaned.lastIndexOf('}') : cleaned.lastIndexOf(']');
    }

    if (end !== -1 && end > start) {
      cleaned = cleaned.substring(start, end + 1);
    }
  }
  
  // If it starts with a markdown list but looks like it should be an object
  if (cleaned.startsWith("- ") && (cleaned.includes(": ") || cleaned.includes('": '))) {
    // This is a common failure mode where the model returns a markdown list instead of JSON
    // We can try to convert it to a simple object if it's simple enough
    const lines = cleaned.split("\n");
    const obj: Record<string, any> = {};
    lines.forEach(line => {
      const match = line.match(/^-\s*(?:"?([^":]+)"?)\s*:\s*(.*)$/);
      if (match) {
        let [_, key, value] = match;
        key = key.trim();
        value = value.trim();
        
        // Try to parse value
        if (value === "true") obj[key] = true;
        else if (value === "false") obj[key] = false;
        else if (!isNaN(Number(value)) && value !== "") obj[key] = Number(value);
        else if (value.startsWith("[") && value.endsWith("]")) {
          try { obj[key] = JSON.parse(value); } catch { obj[key] = value; }
        } else {
          // Remove quotes if present
          obj[key] = value.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
        }
      }
    });
    if (Object.keys(obj).length > 0) {
      return JSON.stringify(obj);
    }
  }

  return cleaned;
}

/**
 * Robust JSON parsing with repair capability for truncated responses.
 */
export function safeJsonParse(text: string): any {
  if (!text) return null;

  const cleaned = cleanJsonString(text);

  // Try standard parse first
  try {
    return JSON.parse(cleaned);
  } catch (e: any) {
    // If it fails with "Unexpected non-whitespace character after JSON", 
    // it likely means there's more than one JSON object.
    // Our cleanJsonString should have handled this with brace matching, 
    // but if it didn't (e.g. if the first object was valid but followed by junk), 
    // we can try to find the error position and truncate.
    if (e.message.includes("Unexpected non-whitespace character after JSON")) {
      const match = e.message.match(/position (\d+)/);
      if (match) {
        const pos = parseInt(match[1], 10);
        try {
          return JSON.parse(cleaned.substring(0, pos));
        } catch (innerError) {
          // Fall through to repair
        }
      }
    }

    // If it fails, try to repair it
    try {
      console.warn("Pipeline: JSON parse failed, attempting repair...");
      const repaired = jsonrepair(cleaned);
      return JSON.parse(repaired);
    } catch (repairError) {
      console.error("Pipeline: JSON repair failed:", repairError);
      
      // Last ditch effort for truncated strings: try to close the last open string and object
      try {
        let manualFix = cleaned;
        if (manualFix.split('"').length % 2 === 0) {
          manualFix += '"';
        }
        const openBraces = (manualFix.match(/\{/g) || []).length;
        const closeBraces = (manualFix.match(/\}/g) || []).length;
        for (let i = 0; i < openBraces - closeBraces; i++) {
          manualFix += '}';
        }
        const openBrackets = (manualFix.match(/\[/g) || []).length;
        const closeBrackets = (manualFix.match(/\]/g) || []).length;
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
          manualFix += ']';
        }
        return JSON.parse(jsonrepair(manualFix));
      } catch (lastDitchError) {
        console.error("Pipeline: Last ditch repair failed:", lastDitchError);
      }

      // If it still fails, check if it's a common "minus sign" error which often means it's a markdown list
      if (e instanceof Error && e.message.includes("minus sign")) {
        console.warn("Detected markdown list instead of JSON. Attempting fallback extraction.");
        // We could try to extract key-value pairs here, but for now we'll just throw
      }
      throw e; // Throw the original error if repair fails
    }
  }
}

export type AIStatus = {
  lastModel: string;
  isLocal: boolean;
  lastError: string | null;
  timestamp: string;
};

let aiStatus: AIStatus = {
  lastModel: "gemini-3-flash-preview",
  isLocal: false,
  lastError: null,
  timestamp: new Date().toISOString(),
};

export const getAIStatus = () => aiStatus;

const updateAIStatus = (status: Partial<AIStatus>) => {
  aiStatus = { ...aiStatus, ...status, timestamp: new Date().toISOString() };
  // Dispatch a custom event so the UI can listen for status changes
  window.dispatchEvent(new CustomEvent("ai-status-update", { detail: aiStatus }));
};

export async function fetchUrlContent(url: string): Promise<string> {
  try {
    const response = await fetch(`https://r.jina.ai/${url}`);
    if (response.ok) {
      return await response.text();
    }
    return "";
  } catch (e) {
    console.error("Failed to fetch URL content:", e);
    return "";
  }
}

export async function fetchAllUrlContexts(urls?: string[]): Promise<string> {
  if (!urls || urls.length === 0) return "";
  try {
    const fetchPromises = urls.map(url => fetchUrlContent(url));
    const results = await Promise.all(fetchPromises);
    return results.filter(r => r.length > 0).join("\n\n---\n\n");
  } catch (e) {
    console.error("Failed to fetch all URL contexts:", e);
    return "";
  }
}

/**
 * Helper to generate content with automatic fallback to Ollama (gemma) or gemini-2.5-flash-lite on quota exhaustion.
 */
export async function generateAIContent(
  params: any,
  context: string,
): Promise<any> {
  if (!currentApiKey) {
    const errorMsg = "Gemini API key is missing. Please configure it in the Secrets panel.";
    console.error(errorMsg);
    updateAIStatus({ lastError: errorMsg });
    toast.error("AI Configuration Error", {
      description: errorMsg,
      duration: 5000,
    });
    throw new Error(errorMsg);
  }
  const primaryModel = params.model || "gemini-3-flash-preview";
  try {
    const config = params.config || {};
    
    // Always enable Google Search grounding for better factual accuracy
    const tools = params.tools || [{ googleSearch: {} }];

    const result = await ai.models.generateContent({
      ...params,
      model: primaryModel,
      tools: tools,
      config: config
    });
    updateAIStatus({ lastModel: primaryModel, isLocal: false, lastError: null });
    return result;
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const isQuotaError =
      errorMessage.includes("429") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.includes("quota");

    if (isQuotaError) {
      console.warn(`Pipeline: Quota exceeded for ${primaryModel}. Attempting local fallback to Ollama (gemma).`);
      updateAIStatus({ lastError: "Quota Exceeded", isLocal: true });
      toast.info("Switching to Local AI", {
        description: "Online quota reached. Falling back to local Gemma model.",
        duration: 3000,
      });

      let promptText = "";
      if (typeof params.contents === 'string') {
        promptText = params.contents;
      } else if (Array.isArray(params.contents)) {
        promptText = params.contents.map((p: any) => p.text || JSON.stringify(p)).join('\n');
      } else if (params.contents?.parts) {
        promptText = params.contents.parts.map((p: any) => p.text || JSON.stringify(p)).join('\n');
      } else {
        promptText = JSON.stringify(params.contents);
      }

      const isJson = params.config?.responseMimeType === "application/json";

      // Fallback 1: NVIDIA NIM (Gemma 3 27B) — cloud, no local setup needed
      try {
        const nvidiaText = await callNvidiaAPI({
          prompt: promptText,
          isJson,
          temperature: params.config?.temperature || 0.7,
          maxTokens: Math.min(params.config?.maxOutputTokens || 4096, 4096),
        });
        if (nvidiaText) {
          updateAIStatus({ lastModel: `Gemma 3 (NVIDIA NIM)`, isLocal: false, lastError: null });
          toast.info("Using Gemma via NVIDIA", { description: "Switched to NVIDIA NIM for this request.", duration: 2000 });
          return { text: nvidiaText, candidates: [{ content: { parts: [{ text: nvidiaText }] } }] };
        }
      } catch (nvidiaError) {
        console.warn("NVIDIA fallback failed:", nvidiaError);
      }

      // Fallback 2: Ollama (local Gemma)
      try {
        const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gemma',
            prompt: promptText,
            stream: false,
            format: isJson ? 'json' : undefined,
            options: { temperature: params.config?.temperature || 0.7 }
          })
        });

        if (!ollamaResponse.ok) throw new Error(`Ollama failed with status ${ollamaResponse.status}`);

        const ollamaData = await ollamaResponse.json();
        updateAIStatus({ lastModel: "Gemma (local Ollama)", isLocal: true, lastError: null });
        return { text: ollamaData.response, candidates: [{ content: { parts: [{ text: ollamaData.response }] } }] };
      } catch (localError) {
        console.warn("Local Ollama fallback failed:", localError);
        updateAIStatus({ lastError: "Local Fallback Failed", isLocal: false });
      }

      // Fallback 3: gemini-2.5-flash-lite (last resort)
      try {
        if (primaryModel !== "gemini-2.5-flash-lite") {
          console.warn("Falling back to gemini-2.5-flash-lite.");
          const result = await ai.models.generateContent({ ...params, model: "gemini-2.5-flash-lite" });
          updateAIStatus({ lastModel: "gemini-2.5-flash-lite", isLocal: false, lastError: null });
          return result;
        }
      } catch (liteError) {
        console.error("gemini-2.5-flash-lite fallback failed:", liteError);
      }
    }

    updateAIStatus({ lastError: errorMessage });
    // If it's still a quota error or something else, let handleApiError deal with it
    handleApiError(error, context);
    throw error;
  }
}

// Internal alias for backward compatibility within this file
const generateContentWithFallback = generateAIContent;

// --- End AI Response Pipeline ---

export interface AICuratedModule {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
}

export interface AILessonBlock {
  type: "definition" | "rules" | "examples" | "quiz" | "exam" | "content";
  title: string;
  content?: string;
  source?: string;
  rules?: string[];
  examples?: { question: string; steps: string[]; answer: string }[];
  quiz?: {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  };
  exam?: { source: string; question: string; hint: string; solution: string };
}

export interface AILesson {
  title: string;
  subtitle: string;
  blocks: AILessonBlock[];
}

export interface AuditResult {
  isAccurate: boolean;
  expectedLanguage: string;
  detectedLanguages: string[];
  feedback: string;
}

export interface LessonSuggestion {
  title: string;
  description: string;
}

export interface LessonTemplate {
  id?: string;
  country: string;
  grade: string;
  subject: string;
  lesson_title: string;
  content: string;
  exercises: any[];
  quizzes: any[];
  mod: string;
  exam: any;
  similarity?: number;
}

export const getLessonPrompt = (
  topic: string,
  country: string,
  grade: string,
  subject: string,
  moduleName: string,
  referenceUrls?: string[],
  existingContext?: string,
  isAdmin: boolean = false,
  urlContexts?: string,
): string => {
  const adminContext = isAdmin ? `
  ADMIN MODE: You are generating content for a GLOBAL ACADEMIC REPOSITORY on Supabase.
  The content must be HIGH-FIDELITY, PEDAGOGICALLY SOUND, and RAG-OPTIMIZED.
  Ensure the content is comprehensive, accurate, and follows national curriculum standards for ${country} strictly.` : "";

  let prompt = `Generate a comprehensive lesson about "${topic}" for a student in ${country} at the ${grade} level, studying ${subject} (Module: ${moduleName}).
    ${adminContext}
    The lesson must be structured exactly according to the provided JSON schema.
    
    CRITICAL INSTRUCTION REGARDING SEARCH:
    You MUST use the Google Search tool to find the official, up-to-date national curriculum, syllabus, and specific lesson content for ${subject} in ${country} for ${grade}. Do not guess or hallucinate the content. Base your response strictly on official educational ministry documents, recognized educational portals, or standard textbooks.

    CRITICAL CONSTRAINTS:
    1. Be precise, academic, and engaging.
    2. Use Markdown for formatting within the "content" fields.
    3. Provide 2-3 exercises, 2-3 quizzes, and 1 exam-style question.
    4. Keep the total content length under 8000 characters to ensure complete JSON generation.
    5. ILLUSTRATIONS: You MUST include 1-2 relevant illustrations in the lesson content using Markdown image syntax. Use the format: ![Alt text](https://picsum.photos/seed/{keyword}/800/400) where {keyword} is a single, highly relevant English word (e.g., physics, biology, history, geography).
    6. MATH FORMATTING: Use clean LaTeX formatting for all math equations (e.g., $x^2$ for inline, $$x^2$$ for block). Do NOT output raw text like "lim x->x0".
    7. PEDAGOGY & STRUCTURE: The lesson content MUST follow a strict pedagogical structure:
       - **Never** write a dense wall of text. Break concepts into bullet points.
       - **Definitions** must be clear and concise.
       - **Intuition/Explanation**: Immediately after a definition, provide a real-world, intuitive example (e.g., "Fast reaction: An explosion. Slow reaction: Rust forming on iron").
       - **Properties/Rules**: Use bullet points. Bold key terms.
       - **Method Template**: Provide step-by-step reasoning.
       - **Example**: Must include a clear, explicit Conclusion at the end.
       - **Formatting**: Use bolding for emphasis, bullet points for lists, and keep paragraphs short (max 3 sentences).
    8. FORMATTING & READABILITY: You MUST avoid "walls of text". 
       - Use bullet points for contrasting concepts or lists.
       - Use **bold text** for key vocabulary words.
       - Provide intuitive, real-world examples immediately after abstract definitions.
       - Keep paragraphs short (max 3-4 sentences).
    
    CRITICAL INSTRUCTION REGARDING LANGUAGE: 
    1. First, identify the official national language of instruction for the specific subject "${subject}" in ${country} for ${grade}.
    2. You MUST generate the ENTIRE lesson content STRICTLY in that SINGLE official native language of instruction. 
    3. DO NOT mix languages. DO NOT provide English translations in parentheses. All text must be 100% in the target language.`;

  if (referenceUrls && referenceUrls.length > 0) {
    prompt += `\n\nCRITICAL INSTRUCTION REGARDING CONTENT SOURCES:
    Base your lesson strictly on the official guidelines and content found in the following reference URLs:
    ${referenceUrls.map(url => `- ${url}`).join('\n')}
    
    Ensure the logic, terminology, and depth match these specific official resources.`;
    
    if (urlContexts) {
      prompt += `\n\nHere is the extracted content from those reference URLs:\n${urlContexts}`;
    }
  }

  if (existingContext) {
    prompt += `\n\nADDITIONAL CONTEXT FROM DATABASE:
    Here are some existing lessons in the database for this subject/grade:
    ${existingContext}
    
    Please ensure the new lesson aligns with this context, builds upon it if relevant, and does not duplicate existing topics unnecessarily.`;
  }

  prompt += `\n\nJSON SCHEMA:
  {
    "country": "string",
    "grade": "string",
    "subject": "string",
    "lesson_title": "string",
    "content": "string (Markdown)",
    "mod": "string (Module name)",
    "exercises": [{"question": "string", "solution": "string"}],
    "quizzes": [{"question": "string", "options": ["string"], "correctAnswer": "string", "explanation": "string"}],
    "exam": {"question": "string", "hint": "string", "solution": "string"}
  }`;

  return prompt;
};

export async function refineLessonContent(rawContent: string): Promise<string> {
  const prompt = `You are an expert pedagogical editor and math formatter. Your task is to take the following raw lesson content and refine it to be production-ready.

Raw Content:
${rawContent}

You MUST apply the following improvements:
1. Clean Math Formatting: Convert any raw text math (e.g., "lim x->x0", "x 0 D f") into clean LaTeX formatting (e.g., $\\lim_{x \\to x_0} f(x)$, $x_0$). Use $ for inline math and $$ for block math.
2. Structure & Hierarchy: Ensure the content follows a clear, hierarchical structure: Title, Definition, Intuition/Explanation, Properties, Method/Step-by-step reasoning, and Example. Use Markdown headings (##, ###) and bold text for structure.
3. Add Explanation Layer: If the raw content jumps from definition to properties without explaining the intuition, add a simple, student-friendly explanation (e.g., "Intuition: Continuity means no jump or break in the graph").
4. Clear Conclusions: Ensure that every example has a clear, explicit conclusion at the end (e.g., "Therefore, f is continuous at x0 = 1").
5. Pedagogical Guidance: Add step-by-step reasoning or a method template if it's missing.

Return ONLY the refined Markdown content. Do not include any conversational filler.`;

  try {
    const response = await generateContentWithFallback(
      {
        model: "gemini-3.1-pro-preview",
        contents: prompt,
      },
      "refineLessonContent"
    );
    return response.text?.trim() || rawContent;
  } catch (error) {
    console.error("Failed to refine lesson content:", error);
    return rawContent; // Fallback to raw content if refinement fails
  }
}

export const generateFullLesson = async (
  topic: string,
  country: string,
  grade: string,
  subject: string,
  moduleName: string,
  retries = 2,
  referenceUrls?: string[],
  existingContext?: string,
  isAdmin: boolean = false,
  _correctionPrompt: string = "", // internal — injected on MCP validation retry
): Promise<LessonTemplate | null> => {
  try {
    let urlContexts = "";
    if (referenceUrls && referenceUrls.length > 0) {
      urlContexts = await fetchAllUrlContexts(referenceUrls);
    }

    // MCP: build curriculum + pedagogy context before generation
    const mcpContext = mcpClient.buildPromptContext(country, grade, subject);

    const basePrompt = getLessonPrompt(topic, country, grade, subject, moduleName, referenceUrls, existingContext, isAdmin, urlContexts);
    // Prepend MCP authority block + any correction from previous failed validation
    const prompt = mcpContext + "\n\n" + (_correctionPrompt || "") + "\n\n" + basePrompt;

    const config: any = {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
      tools: [{ googleSearch: {} }],
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          country: { type: Type.STRING },
          grade: { type: Type.STRING },
          subject: { type: Type.STRING },
          lesson_title: { type: Type.STRING },
          content: {
            type: Type.STRING,
            description: "Main lesson content in Markdown",
          },
          mod: { type: Type.STRING, description: "Module name" },
          exercises: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                solution: { type: Type.STRING },
              },
              required: ["question", "solution"],
            },
          },
              quizzes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswer: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: [
                    "question",
                    "options",
                    "correctAnswer",
                    "explanation",
                  ],
                },
              },
              exam: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  hint: { type: Type.STRING },
                  solution: { type: Type.STRING },
                },
                required: ["question", "solution"],
              },
            },
            required: [
              "country",
              "grade",
              "subject",
              "lesson_title",
              "content",
              "mod",
              "exercises",
              "quizzes",
              "exam",
            ],
          },
        };

    const response = await generateContentWithFallback(
      {
        model: "gemini-3.1-pro-preview", // Use Pro model for generation (more accurate, better for complex lessons)
        contents: prompt,
        config: config,
      },
      "generateFullLesson",
    );

    const text = response.text;
    if (!text) return null;

    try {
      const parsed = safeJsonParse(text);

      // Post-processing: refine content prose
      if (parsed && parsed.content) {
        parsed.content = await refineLessonContent(parsed.content);
      }

      // MCP: validate lesson — language, structure, pedagogy
      if (parsed) {
        const correction = mcpClient.validateAndGetCorrection(
          {
            title:     parsed.lesson_title || topic,
            content:   parsed.content || "",
            exercises: parsed.exercises,
            quizzes:   parsed.quizzes,
          },
          country,
          grade,
          subject,
        );

        if (correction && retries > 0) {
          console.warn(`[MCP] Lesson failed validation. Retrying with correction (${retries} left).`);
          toast.info("MCP: lesson quality check failed — regenerating with corrections.", { duration: 3000 });
          return generateFullLesson(
            topic, country, grade, subject, moduleName,
            retries - 1, referenceUrls, existingContext, isAdmin,
            correction,
          );
        }

        if (correction) {
          // Max retries exhausted — flag the lesson but still return it
          console.warn("[MCP] Lesson still has violations after max retries. Returning with flag.");
          parsed._mcpViolations = correction;
        }
      }

      return parsed;
    } catch (parseError) {
      console.error("JSON Parse Error in generateFullLesson:", parseError);
      if (retries > 0) {
        return generateFullLesson(
          topic, country, grade, subject, moduleName,
          retries - 1, referenceUrls, existingContext, isAdmin, _correctionPrompt,
        );
      }
      throw parseError;
    }
  } catch (error) {
    handleApiError(error, "generateFullLesson");
    if (retries > 0 && !(error instanceof SyntaxError)) {
      return generateFullLesson(
        topic, country, grade, subject, moduleName,
        retries - 1, referenceUrls, existingContext, isAdmin, _correctionPrompt,
      );
    }
    return null;
  }
};

export const generateCurriculum = async (
  country: string,
  grade: string,
  isAdmin: boolean = false,
  retries = 2,
): Promise<AICuratedModule[]> => {
  try {
    // 1. Check Cache
    const cacheKey = getCacheKey("generateCurriculum", country, grade, isAdmin);
    const cachedResponse = await responseCache.get(cacheKey);
    if (cachedResponse) {
      console.log("Pipeline: Cache hit for generateCurriculum");
      return safeJsonParse(cachedResponse);
    }

    let extraContext = "";
    if (country === "MA" || country === "Morocco") {
      extraContext = `\n\nUse the following Moroccan academic structure as a reference for the curriculum:\n${JSON.stringify(moroccanAcademicDb, null, 2)}\nEnsure the modules match the specific grade level provided.`;
    }

    const adminContext = isAdmin ? `
    ADMIN MODE: You are generating content for a GLOBAL ACADEMIC REPOSITORY on Supabase. 
    The content must be PRODUCTION-READY, PEDAGOGICALLY ACCURATE, and follow NATIONAL STANDARDS strictly.
    Focus on high-fidelity module names and professional codes.` : "";

    let response = await generateContentWithFallback(
      {
        model: "gemini-3-flash-preview",
        contents: `Generate a list of 10 academic classrooms (modules) for a student in ${country} at the ${grade} level. 
      The classrooms should be from trusted academic resources and follow the standard curriculum of that region.
      ${adminContext}
      Include a mix of core subjects and interesting electives.
      Keep descriptions concise (max 150 characters).
      IMPORTANT: Generate the names and descriptions in the native language of instruction for that subject in that country (e.g., Arabic, French, or English).${extraContext}`,
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 4096,
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                code: {
                  type: Type.STRING,
                  description: "Short academic code like MATH101",
                },
                name: {
                  type: Type.STRING,
                  description: "Full name of the classroom",
                },
                description: {
                  type: Type.STRING,
                  description: "Brief description of what is learned",
                },
                category: {
                  type: Type.STRING,
                  description: "Category like Science, Humanities, etc.",
                },
              },
              required: ["id", "code", "name", "description", "category"],
            },
          },
        },
      },
      "generateCurriculum",
    );

    const text = response.text;
    if (!text) return [];

    try {
      const parsed = safeJsonParse(text);
      // Save to cache
      await responseCache.set(cacheKey, text);
      return parsed;
    } catch (parseError) {
      console.error("JSON Parse Error in generateCurriculum:", parseError);
      if (retries > 0) {
        return generateCurriculum(country, grade, isAdmin, retries - 1);
      }
      throw parseError;
    }
  } catch (error) {
    handleApiError(error, "generateCurriculum");
    if (retries > 0 && !(error instanceof SyntaxError)) {
      return generateCurriculum(country, grade, isAdmin, retries - 1);
    }
    return [];
  }
};

export const generateSeedLesson = async (
  moduleName: string,
  grade: string,
  country: string,
  retries = 2,
  strictRAG?: boolean,
  existingContext?: string
): Promise<AILesson | null> => {
  try {
    // 1. Check Cache
    const cacheKey = getCacheKey(
      "generateSeedLesson",
      moduleName,
      grade,
      country,
      strictRAG,
      existingContext
    );
    const cachedResponse = await responseCache.get(cacheKey);
    if (cachedResponse) {
      console.log("Pipeline: Cache hit for generateSeedLesson");
      return safeJsonParse(cachedResponse);
    }

    const ragInstruction = strictRAG ? `\nSTRICT RAG MODE IS ENABLED: You MUST firmly base the entire generated lesson strictly on this provided existing context. Do NOT hallucinate concepts outside of this context:\n<EXISTING_CONTEXT>\n${existingContext}\n</EXISTING_CONTEXT>\n\nIf the existing context is empty, simply summarize the topic briefly without generating deep educational material.` : "";

    const response = await generateContentWithFallback(
      {
        model: "gemini-3-flash-preview",
        contents: `Generate a concise introductory seed lesson for the classroom "${moduleName}" for a student in ${country} at the ${grade} level.
      The lesson should be engaging and structured into specific blocks: definition, rules, worked examples, a multiple-choice quiz, a practice exercise, and a national exam style question.
      ${ragInstruction}
      
      CRITICAL CONSTRAINTS:
      1. Keep the total content length under 3000 characters to ensure complete JSON generation.
      2. Be precise and academic.
      3. Use Markdown for formatting within the "content" and "question" fields.
      4. Ensure each block is concise. For example, the "content" should be no more than 800 characters.
      5. FORMATTING & READABILITY: You MUST avoid "walls of text". 
         - **Never** write a dense wall of text. Break concepts into bullet points.
         - **Definitions** must be clear and concise.
         - **Intuition/Explanation**: Immediately after a definition, provide a real-world, intuitive example (e.g., "Fast reaction: An explosion. Slow reaction: Rust forming on iron").
         - **Properties/Rules**: Use bullet points. Bold key terms.
         - **Formatting**: Use bolding for emphasis, bullet points for lists, and keep paragraphs short (max 3 sentences).

      CRITICAL INSTRUCTION REGARDING LANGUAGE: 
      1. First, identify the official national language of instruction for the specific subject "${moduleName}" in ${country} for ${grade}. For example, in the Moroccan educational system, Philosophy, History, Geography, and Islamic Education are taught EXCLUSIVELY in Arabic. Mathematics and Sciences are often taught in French.
      2. You MUST generate the ENTIRE lesson content STRICTLY in that SINGLE official native language of instruction. 
      3. DO NOT mix languages. DO NOT provide English translations in parentheses. All text, including titles, quiz options, hints, and explanations, must be 100% in the target language.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Title of the lesson" },
              subtitle: {
                type: Type.STRING,
                description: "Short subtitle, e.g., '10 blocks · ~20 min'",
              },
              blocks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: {
                      type: Type.STRING,
                      description:
                        "One of: definition, rules, examples, quiz, exercise, exam, content",
                    },
                    title: {
                      type: Type.STRING,
                      description: "Title of the block",
                    },
                    content: {
                      type: Type.STRING,
                      description:
                        "Markdown content (for definition or content type)",
                    },
                    source: {
                      type: Type.STRING,
                      description:
                        "Source citation (e.g., Official Manual p.62)",
                    },
                    rules: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "List of rules (for rules type)",
                    },
                    examples: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          question: { type: Type.STRING },
                          steps: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                          },
                          answer: { type: Type.STRING },
                        },
                      },
                    },
                    quiz: {
                      type: Type.OBJECT,
                      properties: {
                        question: { type: Type.STRING },
                        options: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                        correctAnswer: { type: Type.STRING },
                        explanation: { type: Type.STRING },
                      },
                    },
                    exercise: {
                      type: Type.OBJECT,
                      properties: {
                        question: { type: Type.STRING },
                        hint: { type: Type.STRING },
                        solution: { type: Type.STRING },
                      },
                    },
                    exam: {
                      type: Type.OBJECT,
                      properties: {
                        source: { type: Type.STRING },
                        question: { type: Type.STRING },
                        hint: { type: Type.STRING },
                        solution: { type: Type.STRING },
                      },
                    },
                  },
                  required: ["type", "title"],
                },
              },
            },
            required: ["title", "subtitle", "blocks"],
          },
          maxOutputTokens: 8192,
        },
      },
      "generateSeedLesson",
    );

    const text = response.text;
    if (!text) return null;

    try {
      const parsed = safeJsonParse(text);
      // Save to cache
      await responseCache.set(cacheKey, text);
      return parsed;
    } catch (parseError) {
      console.error("JSON Parse Error in generateSeedLesson:", parseError);
      if (retries > 0) {
        console.log(
          `Retrying generateSeedLesson... (${retries} attempts left)`,
        );
        return generateSeedLesson(moduleName, grade, country, retries - 1);
      }
      throw parseError;
    }
  } catch (error) {
    handleApiError(error, "generateSeedLesson");
    if (retries > 0 && !(error instanceof SyntaxError)) {
      return generateSeedLesson(moduleName, grade, country, retries - 1);
    }
    return null;
  }
};

export const generateAnotherExample = async (
  lessonTitle: string,
  blockTitle: string,
  existingExamples: { question: string; steps: string[]; answer: string }[],
  grade: string,
  country: string,
  strictRAG?: boolean
): Promise<{ question: string; steps: string[]; answer: string } | null> => {
  try {
    let prompt = `You are an expert tutor for ${grade} students in ${country}.
    The student is learning about "${lessonTitle}" and is currently looking at the section "${blockTitle}".
    
    Here are the existing examples they have already seen:
    ${JSON.stringify(existingExamples, null, 2)}
    
    Please generate ONE new, distinct example that is similar in difficulty but covers a slightly different angle or numbers.
    It must follow the exact same JSON structure:
    {
      "question": "The problem statement (use Markdown/LaTeX)",
      "steps": ["Step 1...", "Step 2..."],
      "answer": "The final answer"
    }
    
    Ensure the math is formatted cleanly using LaTeX (e.g., $x^2$).`;
    
    if (strictRAG) {
      prompt += `\nSTRICT RAG MODE ENABLED: Confine your new example strictly to the formulas or models presented in the above existing examples. Do not introduce higher-level concepts not explicitly proven by the existing examples.`;
    }

    const response = await generateContentWithFallback(
      {
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              answer: { type: Type.STRING },
            },
            required: ["question", "steps", "answer"],
          },
        },
      },
      "generateAnotherExample"
    );

    const text = response.text;
    if (!text) return null;

    return safeJsonParse(text);
  } catch (error) {
    handleApiError(error, "generateAnotherExample");
    return null;
  }
};

export const generateLessonSuggestions = async (
  moduleName: string,
  grade: string,
  country: string,
  retries = 2,
  existingTopics?: string[]
): Promise<LessonSuggestion[]> => {
  try {
    // 1. Check Cache
    const cacheKey = getCacheKey(
      "generateLessonSuggestions",
      moduleName,
      grade,
      country,
      existingTopics
    );
    const cachedResponse = await responseCache.get(cacheKey);
    if (cachedResponse) {
      console.log("Pipeline: Cache hit for generateLessonSuggestions");
      return safeJsonParse(cachedResponse);
    }

    const topicsContext = existingTopics && existingTopics.length > 0
      ? `\n\nCRITICAL: The admin has already defined the following topics for this subject. You MUST use these topics as the basis for your suggestions:\n${existingTopics.join('\n')}`
      : "";

    const response = await generateContentWithFallback(
      {
        model: "gemini-3-flash-preview",
        contents: `Provide a list of 10 specific lesson topics for a curriculum module named "${moduleName}" for ${grade} in ${country}.${topicsContext}
      Each topic should have a title and a short 1-sentence description of what it covers.
      Keep descriptions concise (max 150 characters).
      CRITICAL INSTRUCTION REGARDING LANGUAGE: 
      1. First, identify the official national language of instruction for the specific subject "${moduleName}" in ${country} for ${grade}. For example, in the Moroccan educational system, Philosophy, History, Geography, and Islamic Education are taught EXCLUSIVELY in Arabic.
      2. Generate the titles and descriptions STRICTLY in that SINGLE official native language of instruction. 
      3. DO NOT mix languages. DO NOT provide English translations.`,
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 4096,
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
              },
              required: ["title", "description"],
            },
          },
        },
      },
      "generateLessonSuggestions",
    );

    const text = response.text;
    if (!text) return [];

    try {
      const parsed = safeJsonParse(text);
      // Save to cache
      await responseCache.set(cacheKey, text);
      return parsed;
    } catch (parseError) {
      console.error(
        "JSON Parse Error in generateLessonSuggestions:",
        parseError,
      );
      if (retries > 0) {
        return generateLessonSuggestions(
          moduleName,
          grade,
          country,
          retries - 1,
          existingTopics
        );
      }
      throw parseError;
    }
  } catch (error) {
    handleApiError(error, "generateLessonSuggestions");
    if (retries > 0 && !(error instanceof SyntaxError)) {
      return generateLessonSuggestions(moduleName, grade, country, retries - 1, existingTopics);
    }
    return [];
  }
};

export const explainText = async (
  text: string,
  context: string,
  grade: string,
  country: string,
  userLanguage?: string,
  strictRAG?: boolean,
): Promise<string> => {
  try {
    // 1. Check Cache
    const cacheKey = getCacheKey(
      "explainText",
      text,
      context,
      grade,
      country,
      userLanguage,
      strictRAG
    );
    const cachedResponse = await responseCache.get(cacheKey);
    if (cachedResponse) {
      console.log("Pipeline: Cache hit for explainText");
      return cachedResponse;
    }

    // 2. Determine Model (Simple task doesn't apply to explanations)
    const modelToUse = determineModel(text, context.length);
    console.log(`Pipeline: Using model ${modelToUse} for explainText`);

    const ragInstruction = strictRAG ? `\nSTRICT RAG MODE IS ENABLED: Your explanation MUST be derived entirely from the provided Lesson Context. Do not introduce outside concepts, formulas, or history unless it is logically deducible directly from the text.` : "";

    const response = await generateContentWithFallback(
      {
        model: modelToUse,
        contents: `Explain the following highlighted text from an academic lesson.
      
      Highlighted Text: "${text}"
      
      Lesson Context: "${context}"
      
      Target Audience: A student in ${country} at the ${grade} level.
      ${ragInstruction}
      
      Provide a clear, concise, and academic explanation. If the text is in a specific language (like Arabic or French), provide the explanation in that same language. ${userLanguage ? `The user's preferred language is ${userLanguage}. If it helps their understanding, you may provide the explanation or a summary in ${userLanguage}.` : ""}`,
        config: {
          maxOutputTokens: 2048,
        },
      },
      "explainText",
    );

    const responseText =
      response.text || "I couldn't generate an explanation for that text.";

    // Save to cache
    await responseCache.set(cacheKey, responseText);

    return responseText;
  } catch (error) {
    handleApiError(error, "explainText");
    return "Failed to connect to the AI service. Please try again.";
  }
};

export const auditLessonLanguage = async (
  lessonTitle: string,
  lessonBlocks: any[],
  moduleName: string,
  grade: string,
  country: string,
  retries = 2,
): Promise<AuditResult> => {
  try {
    const contentToAudit = JSON.stringify({
      title: lessonTitle,
      blocks: lessonBlocks,
    });

    // 1. Check Cache
    const cacheKey = getCacheKey(
      "auditLessonLanguage",
      contentToAudit,
      moduleName,
      grade,
      country,
    );
    const cachedResponse = await responseCache.get(cacheKey);
    if (cachedResponse) {
      console.log("Pipeline: Cache hit for auditLessonLanguage");
      return safeJsonParse(cachedResponse);
    }

    const response = await generateContentWithFallback(
      {
        model: "gemini-3-flash-preview",
        contents: `You are an educational content auditor.
      Review the following lesson content for a student in ${country} at the ${grade} level, studying "${moduleName}".
      1. Determine the SINGLE primary native language of instruction expected for this specific subject in this country. For example, in Morocco, Philosophy, History, Geography, and Islamic Education are taught EXCLUSIVELY in Arabic.
      2. Analyze the provided lesson content to see if it strictly adheres to that language.
      3. If it mixes languages inappropriately (e.g., providing English translations in parentheses, or mixing Arabic and French when it should just be Arabic), flag it as inaccurate.

      Lesson Content:
      ${contentToAudit}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isAccurate: {
                type: Type.BOOLEAN,
                description:
                  "True if the language is consistent and strictly uses the expected language without inappropriate mixing.",
              },
              expectedLanguage: {
                type: Type.STRING,
                description: "The single expected language of instruction.",
              },
              detectedLanguages: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "All languages detected in the content.",
              },
              feedback: {
                type: Type.STRING,
                description:
                  "Detailed feedback on the language usage, specifying where mixing occurred if any.",
              },
            },
            required: [
              "isAccurate",
              "expectedLanguage",
              "detectedLanguages",
              "feedback",
            ],
          },
        },
      },
      "auditLessonLanguage",
    );

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    try {
      const parsed = safeJsonParse(text);
      await responseCache.set(cacheKey, text);
      return parsed;
    } catch (parseError) {
      console.error("JSON Parse Error in auditLessonLanguage:", parseError);
      if (retries > 0) {
        return auditLessonLanguage(
          lessonTitle,
          lessonBlocks,
          moduleName,
          grade,
          country,
          retries - 1,
        );
      }
      throw parseError;
    }
  } catch (error) {
    handleApiError(error, "auditLessonLanguage");
    if (retries > 0 && !(error instanceof SyntaxError)) {
      return auditLessonLanguage(
        lessonTitle,
        lessonBlocks,
        moduleName,
        grade,
        country,
        retries - 1,
      );
    }
    throw error;
  }
};

export const generateLessonTags = async (
  lessonTitle: string,
  content: string,
  grade: string,
  country: string,
): Promise<string[]> => {
  try {
    // 1. Check Cache
    const cacheKey = getCacheKey(
      "generateLessonTags",
      lessonTitle,
      content,
      grade,
      country,
    );
    const cachedResponse = await responseCache.get(cacheKey);
    if (cachedResponse) {
      console.log("Pipeline: Cache hit for generateLessonTags");
      return safeJsonParse(cachedResponse);
    }

    const response = await generateContentWithFallback(
      {
        model: "gemini-3-flash-preview",
        contents: `Generate a list of 5-7 relevant academic tags for the following lesson.
      
      Lesson Title: "${lessonTitle}"
      
      Lesson Content: "${content.substring(0, 2000)}"
      
      Target Audience: A student in ${country} at the ${grade} level.
      
      Provide the tags in the same language as the lesson content.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
      "generateLessonTags",
    );

    const text = response.text;
    if (!text) return [];

    const parsed = safeJsonParse(text);
    await responseCache.set(cacheKey, text);
    return parsed;
  } catch (error) {
    handleApiError(error, "generateLessonTags");
    return [];
  }
};

export const generateProactiveGreeting = async (
  lessonContent: string,
  userLanguage?: string,
): Promise<string> => {
  try {
    // 1. Check Cache
    const cacheKey = getCacheKey(
      "generateProactiveGreeting",
      lessonContent,
      userLanguage,
    );
    const cachedResponse = await responseCache.get(cacheKey);
    if (cachedResponse) {
      console.log("Pipeline: Cache hit for generateProactiveGreeting");
      return cachedResponse;
    }

    // 2. Determine Model (Use fast model for greetings)
    const modelToUse = "gemini-2.5-flash-lite";
    console.log(
      `Pipeline: Using model ${modelToUse} for generateProactiveGreeting`,
    );

    const response = await generateContentWithFallback(
      {
        model: modelToUse,
        contents: `Analyze the following lesson content. If the concepts appear particularly complex, advanced, or dense, generate a friendly, proactive message offering to break down the complex parts step-by-step or provide simpler examples. If the content is straightforward, offer to help with any questions, summarize it, or quiz the student on the material. Keep the message brief (1-3 sentences), encouraging, and conversational. Respond in the same language as the lesson content, unless the user's preferred language (${userLanguage || "unknown"}) is different and you think it would help them understand better.
      
      LESSON CONTENT:
      ${lessonContent.substring(0, 4000)}`,
        config: {
        },
      },
      "generateProactiveGreeting",
    );

    const responseText =
      response.text ||
      "How can I help you with this lesson? I can answer questions, explain concepts, or test your knowledge.";

    // Save to cache
    await responseCache.set(cacheKey, responseText);

    return responseText;
  } catch (error) {
    handleApiError(error, "generateProactiveGreeting");
    return "How can I help you with this lesson? I can answer questions, explain concepts, or test your knowledge.";
  }
};

export interface ChatMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

export const chatWithTutor = async (
  message: string,
  lessonContext: string,
  history: ChatMessage[],
  userLanguage?: string,
  userId?: string,
  strictRAG?: boolean
): Promise<string> => {
  try {
    // 1. Check Cache
    const cacheKey = getCacheKey(
      "chatWithTutor",
      message,
      lessonContext,
      history,
      userLanguage,
      userId,
      strictRAG
    );
    const cachedResponse = await responseCache.get(cacheKey);
    if (cachedResponse) {
      console.log("Pipeline: Cache hit for chatWithTutor");
      return cachedResponse;
    }

    // 2. Check Simple Task
    const simpleResponse = handleSimpleTask(message);
    if (simpleResponse) {
      console.log("Pipeline: Simple task matched");
      return simpleResponse;
    }

    // 3. Determine Model
    const modelToUse = determineModel(message, lessonContext.length);
    console.log(`Pipeline: Using model ${modelToUse} for chatWithTutor`);

    // 4. Augment Context with RAG (Retrieval-Augmented Generation)
    let augmentedContext = lessonContext;
    if (userId) {
      try {
        const ragContext = await searchContextForGeneration(userId, message);
        if (ragContext) {
          augmentedContext = `${lessonContext}\n\n--- ADDITIONAL RELEVANT CONTEXT FROM YOUR PAST LESSONS ---\n${ragContext}`;
          console.log("Pipeline: Augmented context with RAG");
        }
      } catch (ragError) {
        console.error(
          "Pipeline: Failed to augment context with RAG:",
          ragError,
        );
        // Continue without RAG if it fails
      }
    }

    const strictRagInstruction = strictRAG ? `\nSTRICT RAG MODE IS ENABLED: You MUST ONLY answer based on the provided LESSON CONTENT and ADDITIONAL RELEVANT CONTEXT. Do NOT generate content outside this context. Do NOT suggest ideas that are not mathematically or logically derivable strictly from the provided text.` : `SECONDARY RULE: If the user asks a question or requests information that is NOT covered in the provided contexts, you must use the Google Search tool to find the answer from the web. When you use web information, briefly mention that you are bringing in outside knowledge to supplement the lesson.`;
    const createChat = (model: string) =>
      ai.chats.create({
        model: model,
        config: {
          systemInstruction: `You are an AI tutor helping a student understand a specific lesson. 
PRIMARY RULE: You should first try to answer questions, explain concepts, extend ideas, or generate practice questions using ONLY the provided LESSON CONTENT and ADDITIONAL RELEVANT CONTEXT.
${strictRagInstruction}
${userLanguage ? `\nThe user's preferred interface language is '${userLanguage}'. If they ask for explanations in another language, or if it helps them understand better, feel free to use their preferred language or any other language they request.` : ""}

LESSON CONTENT:
${augmentedContext}`,
          tools: strictRAG ? [] : [{ googleSearch: {} }],
          toolConfig: { includeServerSideToolInvocations: true },
        },
        history: history,
      });

    let chat = createChat(modelToUse);
    let response;

    try {
      response = await chat.sendMessage({ message });
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      const isQuotaError =
        errorMessage.includes("429") ||
        errorMessage.includes("RESOURCE_EXHAUSTED") ||
        errorMessage.includes("quota");

      if (isQuotaError && modelToUse !== "gemini-2.5-flash-lite") {
        console.warn(
          `Pipeline: Quota exceeded for ${modelToUse}. Falling back to gemini-2.5-flash-lite for chat.`,
        );
        toast.info("Switching AI Model", {
          description:
            "Primary model quota reached. Switching to a lighter model for this chat.",
          duration: 3000,
        });
        chat = createChat("gemini-2.5-flash-lite");
        response = await chat.sendMessage({ message });
      } else {
        throw error;
      }
    }

    const responseText =
      response.text || "I'm sorry, I couldn't generate a response.";

    // Save to cache
    await responseCache.set(cacheKey, responseText);

    return responseText;
  } catch (error) {
    handleApiError(error, "chatWithTutor");
    throw error;
  }
};

export const generateFlashcards = async (
  lessonContent: string,
): Promise<{ front: string; back: string }[]> => {
  try {
    // 1. Check Cache
    const cacheKey = getCacheKey("generateFlashcards", lessonContent);
    const cachedResponse = await responseCache.get(cacheKey);
    if (cachedResponse) {
      console.log("Pipeline: Cache hit for generateFlashcards");
      return safeJsonParse(cachedResponse);
    }

    const response = await generateContentWithFallback(
      {
        model: "gemini-3-flash-preview",
        contents: `Generate 5 to 10 study flashcards based on the following lesson content. 
      Extract the most important key terms, concepts, or questions for the front of the card, and provide clear, concise definitions or answers for the back.
      
      LESSON CONTENT:
      ${lessonContent.substring(0, 5000)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                front: {
                  type: Type.STRING,
                  description: "Key term, concept, or question",
                },
                back: {
                  type: Type.STRING,
                  description: "Definition, explanation, or answer",
                },
              },
              required: ["front", "back"],
            },
          },
        },
      },
      "generateFlashcards",
    );

    const text = response.text;
    if (!text) return [];

    const parsed = safeJsonParse(text);
    await responseCache.set(cacheKey, text);
    return parsed;
  } catch (error) {
    handleApiError(error, "generateFlashcards");
    return [];
  }
};

export const generateInteractiveContent = async (
  type: "hard_questions" | "more_examples" | "exam_questions",
  lessonContent: string,
  grade: string,
  country: string,
  strictRAG?: boolean,
): Promise<string> => {
  try {
    // 1. Check Cache
    const cacheKey = getCacheKey(
      "generateInteractiveContent",
      type,
      lessonContent,
      grade,
      country,
      strictRAG
    );
    const cachedResponse = await responseCache.get(cacheKey);
    if (cachedResponse) {
      console.log("Pipeline: Cache hit for generateInteractiveContent");
      return cachedResponse;
    }

    let prompt = "";
    if (type === "hard_questions") {
      prompt = `Based on the following lesson content, generate 3 challenging, high-level thinking questions that test deep understanding. Provide the answers as well. Use Markdown for formatting.`;
    } else if (type === "more_examples") {
      prompt = `Based on the following lesson content, provide 3 additional complex examples with step-by-step solutions. Use Markdown for formatting.`;
    } else if (type === "exam_questions") {
      prompt = `Based on the following lesson content, generate 3 exam-style questions (like national exams in ${country} for ${grade}). Provide the solutions as well. Use Markdown for formatting.`;
    }
    
    if (strictRAG) {
       prompt += `\n\nSTRICT RAG MODE ENABLED: Your generations MUST be rigorously verifiable against the following text. Do not invent formulas, historical events, or facts not present in this context.`;
    }

    const response = await generateContentWithFallback(
      {
        model: "gemini-3-flash-preview",
        contents: `${prompt}
      
      LESSON CONTENT:
      ${lessonContent.substring(0, 5000)}
      
      Target Audience: A student in ${country} at the ${grade} level.
      
      IMPORTANT: Generate the content in the same language as the lesson content.`,
        config: {
        },
      },
      "generateInteractiveContent",
    );

    const responseText =
      response.text || "I couldn't generate the content. Please try again.";
    await responseCache.set(cacheKey, responseText);
    return responseText;
  } catch (error) {
    handleApiError(error, "generateInteractiveContent");
    return "Failed to connect to the AI service. Please try again.";
  }
};

export const generateCauseEffect = async (
  lessonContent: string,
): Promise<{ cause: string; effect: string }[]> => {
  try {
    // 1. Check Cache
    const cacheKey = getCacheKey("generateCauseEffect", lessonContent);
    const cachedResponse = await responseCache.get(cacheKey);
    if (cachedResponse) {
      console.log("Pipeline: Cache hit for generateCauseEffect");
      return safeJsonParse(cachedResponse);
    }

    const response = await generateContentWithFallback(
      {
        model: "gemini-3-flash-preview",
        contents: `Analyze the following lesson content and identify 3 to 6 cause-and-effect relationships.
      For each relationship, provide a clear 'cause' (the trigger or event) and its corresponding 'effect' (the result or consequence).
      
      LESSON CONTENT:
      ${lessonContent.substring(0, 5000)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                cause: {
                  type: Type.STRING,
                  description: "The trigger or event",
                },
                effect: {
                  type: Type.STRING,
                  description: "The result or consequence",
                },
              },
              required: ["cause", "effect"],
            },
          },
        },
      },
      "generateCauseEffect",
    );

    const text = response.text;
    if (!text) return [];

    const parsed = safeJsonParse(text);
    await responseCache.set(cacheKey, text);
    return parsed;
  } catch (error) {
    handleApiError(error, "generateCauseEffect");
    return [];
  }
};

/**
 * Summarizes text using Gemini with a fallback to gemini-2.5-flash-lite and then local Transformers AI if quota is exceeded.
 */
export const summarizeWithFallback = async (text: string): Promise<string> => {
  try {
    // Try the "Smart" AI (Gemini)
    const response = await generateContentWithFallback(
      {
        model: "gemini-3-flash-preview",
        contents: `Summarize the following text in a concise manner:\n\n${text}`,
        config: {
        },
      },
      "summarizeWithFallback",
    );
    return response.text || "Failed to generate summary.";
  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    // Check for 429 (Quota Exceeded) - this block is reached if even gemini-2.5-flash-lite fails
    if (
      errorMessage.includes("429") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.includes("quota")
    ) {
      console.log(
        "Pipeline: All Gemini models quota exceeded, falling back to Local AI (Transformers)",
      );
      toast.info("Using Local AI", {
        description:
          "Gemini quota reached. Falling back to local model for summarization.",
        duration: 3000,
      });
      return await transformersService.summarize(text); // Fallback to "Local" AI
    }
    // For other errors, handle normally
    handleApiError(err, "summarizeWithFallback");
    return "An error occurred during summarization.";
  }
};

/**
 * Alias for summarizeWithFallback to match user's example logic.
 */
export const getSummary = summarizeWithFallback;

/**
 * Generates a syllabus/topic list based on country, grade, and subject.
 */
export const generateSyllabus = async (
  country: string,
  grade: string,
  subject: string,
  referenceUrls?: string[]
): Promise<string> => {
  try {
    let urlContexts = "";
    if (referenceUrls && referenceUrls.length > 0) {
      urlContexts = await fetchAllUrlContexts(referenceUrls);
    }

    const prompt = `You are an expert curriculum designer for ${country}.
    Generate a comprehensive syllabus/topic list for ${grade} ${subject}.
    
    CRITICAL INSTRUCTION REGARDING SEARCH:
    You MUST use the Google Search tool to find the official, up-to-date national curriculum or syllabus for ${subject} in ${country} for ${grade}. Do not guess or hallucinate the topics. Base your response strictly on official educational ministry documents or recognized educational portals.

    Return ONLY a list of topics, one per line. Do not include numbers, bullet points, or introductory text. Just the raw topic names.
    Make it logically ordered from beginning of the year to end of the year.
    ${referenceUrls && referenceUrls.length > 0 ? `Base your syllabus on these official guidelines: ${referenceUrls.join(', ')}` : ''}
    ${urlContexts ? `\nExtracted content from Reference URLs:\n${urlContexts}\n` : ''}`;

    const response = await generateContentWithFallback(
      {
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          tools: [{ googleSearch: {} }],
        },
      },
      "generateSyllabus",
    );

    return response.text?.trim() || "";
  } catch (error) {
    console.error("Error generating syllabus:", error);
    throw error;
  }
};

/**
 * Ask AI & RAG Search for Admin Panel
 */
export const askAdminAI = async (
  question: string,
  context: any
): Promise<string> => {
  try {
    const prompt = `You are a Senior Curriculum Architect & Database Manager for LevelSpace. Your primary goal is to help the admin seamlessly scale, optimize, and manage their global educational repository on Supabase.
    
    You have full visibility into the current academic context and can provide guidance on CRUD operations (Create, Read, Update, Delete), data validation, and quality testing.
    
    Here is the current context of the admin's session:
    - Target Country: ${context.country || 'Not set'}
    - Target Grade: ${context.grade || 'Not set'}
    - Target Subject: ${context.subject || 'Not set'}
    - Local Modules Count: ${context.localModulesCount}
    - Local Lessons Count: ${context.localLessonsCount}
    - RAG Lessons in Database for this filter: ${context.ragLessonsCount}
    - Admin Timezone: ${context.timezone}
    - Current Time: ${new Date().toLocaleString()}
    
    The admin is asking: "${question}"
    
    CRITICAL INSTRUCTION REGARDING SEARCH:
    If the admin's request requires fetching external data, official curriculum documents, or specific national guidelines that are not in your immediate context, you MUST use the Google Search tool to find that information before answering. Do not hallucinate official curriculum details.
    
    Based on this session data and any search results, provide a structured management report. Your response MUST include:
    1. 📊 Current Status & Validation: A brief analysis of the current data state. Identify any gaps, inconsistencies, or areas needing validation against national standards.
    2. 🛠️ Management Recommendations: Specific advice on content management. This could include suggestions to drop outdated content, update specific parts of a curriculum, or create new modules to fill gaps.
    3. 🚀 Supabase Action Plan: Actionable, specific next steps for the admin to execute on Supabase. Provide technical guidance or JSON/SQL structures if applicable.
    4. ✅ Quality Assurance: How to test and validate the generated content for this specific context.
    
    Keep the response concise, professional, and highly actionable. Use Markdown for formatting.`;

    const response = await generateContentWithFallback(
      {
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          maxOutputTokens: 4096,
          tools: [{ googleSearch: {} }],
        },
      },
      "askAdminAI",
    );

    return response.text?.trim() || "I couldn't generate a response.";
  } catch (error) {
    console.error("Error asking Admin AI:", error);
    throw error;
  }
};

/**
 * Auditor Agent: Analyzes a classroom and defines missed content.
 */
export interface ClassroomAuditReport {
  summary: string;
  existingTopics: string[];
  missingTopics: string[];
  todoList: {
    task: string;
    priority: "high" | "medium" | "low";
    agent: "Lesson Generator" | "Interactive Suite" | "Curriculum Architect";
    payload: any;
  }[];
}

export const auditClassroomContent = async (
  moduleName: string,
  country: string,
  grade: string,
  subject: string,
  existingLessons: { title: string, content: string }[]
): Promise<ClassroomAuditReport | null> => {
  try {
    const prompt = `You are a Senior Academic Auditor. Your task is to audit the content of an educational classroom (module) and identify gaps across three categories: Lessons, Quizzes, and Exercises.
    
    Classroom Details:
    - Name: ${moduleName}
    - Subject: ${subject}
    - Country: ${country}
    - Grade: ${grade}
    
    Existing Lessons in Database:
    ${existingLessons.map(t => `\n--- Lesson: ${t.title} ---\n${t.content ? t.content.substring(0, 1000) + '...' : 'No content'}`).join('\n')}
    
    Your Audit Process:
    1. Compare the existing content against the standard national curriculum for ${country} at the ${grade} level for ${subject}.
    2. Identify critical gaps in:
       - LESSONS: Are there missing core topics?
       - QUIZZES: Does every major topic have a corresponding assessment?
       - EXERCISES: Is there enough practice material for complex concepts?
    3. Create a prioritized To-Do list of ALL missing tasks for other AI agents to complete the classroom. Do not limit yourself to just one task. If there are 5 missing lessons, list 5 tasks.
    4. IMPORTANT: Do NOT suggest tasks for topics that are already covered in the "Existing Lessons in Database".
    
    Respond strictly in JSON format with this schema:
    {
      "summary": "Overall audit summary focusing on lessons, quizzes, and exercises",
      "existingTopics": ["list of current topics"],
      "missingTopics": ["list of missing topics/assessments/practices"],
      "todoList": [
        {
          "task": "Description of the task (e.g., 'Generate Quiz for Photosynthesis')",
          "priority": "high|medium|low",
          "agent": "Lesson Generator|Interactive Suite|Curriculum Architect",
          "payload": { 
            "topic": "Topic name", 
            "type": "lesson_generation|quiz_generation|exercise_generation" 
          }
        }
      ]
    }`;

    const response = await generateContentWithFallback(
      {
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              existingTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
              missingTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
              todoList: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    task: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ["high", "medium", "low"] },
                    agent: { type: Type.STRING },
                    payload: { type: Type.OBJECT }
                  },
                  required: ["task", "priority", "agent", "payload"]
                }
              }
            },
            required: ["summary", "existingTopics", "missingTopics", "todoList"]
          }
        }
      },
      "auditClassroomContent"
    );

    const text = response.text;
    if (!text) return null;
    return safeJsonParse(text);
  } catch (error) {
    handleApiError(error, "auditClassroomContent");
    return null;
  }
};

export interface ExtractionEvaluation {
  isSufficient: boolean;
  extractedSummary: string;
  weaknesses: string[];
  missingInformation: string[];
}

export async function smartExtractFromResource(
  fileData: string, 
  mimeType: string, 
  instruction: string
): Promise<string | null> {
  try {
    const prompt = `You are an expert data extractor. Extract the required content based on the following instruction. Be smart about finding dates, numbers, and key facts even if the data is sparse or poorly scanned.\n\nInstruction: ${instruction}`;
    
    const response = await generateContentWithFallback(
      {
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: fileData,
                  mimeType: mimeType
                }
              }
            ]
          }
        ],
        config: {
          maxOutputTokens: 8192, // Increased for large extractions
        }
      },
      "smartExtractFromResource"
    );
    return response.text || null;
  } catch (error) {
    handleApiError(error, "smartExtractFromResource");
    return null;
  }
}

export async function evaluateExtractionWeakness(
  extractedContent: string, 
  targetGoal: string
): Promise<ExtractionEvaluation | null> {
  try {
    const prompt = `You are a Quality Assurance Evaluator. Your role is to define weaknesses in the data extraction process.
    
    Target Goal/Instruction: ${targetGoal}
    
    Extracted Content:
    ${extractedContent}
    
    Evaluate if the extracted content sufficiently meets the target goal. Identify any weaknesses, poor scan quality artifacts, or missing information (especially dates or key facts).
    
    Respond strictly in JSON format with this schema:
    {
      "isSufficient": boolean,
      "extractedSummary": "string",
      "weaknesses": ["string"],
      "missingInformation": ["string"]
    }`;

    const response = await generateContentWithFallback(
      {
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isSufficient: { type: Type.BOOLEAN },
              extractedSummary: { type: Type.STRING },
              weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
              missingInformation: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["isSufficient", "extractedSummary", "weaknesses", "missingInformation"]
          }
        }
      },
      "evaluateExtractionWeakness"
    );

    const text = response.text;
    if (!text) return null;
    return safeJsonParse(text);
  } catch (error) {
    handleApiError(error, "evaluateExtractionWeakness");
    return null;
  }
}

export const MAX_QUIZZES_PER_LESSON = 5;
export const MAX_EXERCISES_PER_LESSON = 5;

export const generateQuizzesForLesson = async (
  lessonTitle: string,
  lessonContent: string,
  existingCount: number,
  targetCount: number = MAX_QUIZZES_PER_LESSON,
  country: string = "",
  grade: string = "",
): Promise<any[]> => {
  const needed = Math.max(0, targetCount - existingCount);
  if (needed === 0) return [];

  const prompt = `Generate ${needed} multiple-choice quiz questions for this lesson.
Lesson: "${lessonTitle}"
Content: ${lessonContent.substring(0, 3000)}
${country ? `Country: ${country}, Grade: ${grade}` : ""}

Return ONLY a JSON array (no markdown):
[{"question":"...","options":["A","B","C","D"],"correctAnswer":"exact option text","explanation":"..."}]`;

  try {
    const response = await generateContentWithFallback(
      { model: "gemini-3-flash-preview", contents: prompt, config: { responseMimeType: "application/json", maxOutputTokens: 2048 } },
      "generateQuizzesForLesson"
    );
    const parsed = safeJsonParse(response.text || "");
    return Array.isArray(parsed) ? parsed.slice(0, needed) : [];
  } catch {
    return [];
  }
};

export const generateExercisesForLesson = async (
  lessonTitle: string,
  lessonContent: string,
  existingCount: number,
  targetCount: number = MAX_EXERCISES_PER_LESSON,
  country: string = "",
  grade: string = "",
): Promise<any[]> => {
  const needed = Math.max(0, targetCount - existingCount);
  if (needed === 0) return [];

  const prompt = `Generate ${needed} practice exercises for this lesson.
Lesson: "${lessonTitle}"
Content: ${lessonContent.substring(0, 3000)}
${country ? `Country: ${country}, Grade: ${grade}` : ""}

Return ONLY a JSON array (no markdown):
[{"question":"problem statement (use LaTeX for math)","hint":"optional hint","solution":"step-by-step solution"}]`;

  try {
    const response = await generateContentWithFallback(
      { model: "gemini-3-flash-preview", contents: prompt, config: { responseMimeType: "application/json", maxOutputTokens: 2048 } },
      "generateExercisesForLesson"
    );
    const parsed = safeJsonParse(response.text || "");
    return Array.isArray(parsed) ? parsed.slice(0, needed) : [];
  } catch {
    return [];
  }
};

export async function findSimilarResources(
  topic: string, 
  weaknesses: string[]
): Promise<string | null> {
  try {
    const prompt = `You are an AI Research Assistant. The current resources for the topic "${topic}" have the following weaknesses/missing information:
    ${weaknesses.map(w => `- ${w}`).join('\n')}
    
    Take the initiative to find similar or supplementary resources that address these weaknesses. Provide a highly detailed, comprehensive report that includes actual facts, extensive explanations, and specific data to fill the gaps. Do not just provide search queries; provide the actual information found from the web. Include links to the sources where possible.`;

    const response = await generateContentWithFallback(
      {
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      },
      "findSimilarResources"
    );
    return response.text || null;
  } catch (error) {
    handleApiError(error, "findSimilarResources");
    return null;
  }
}
