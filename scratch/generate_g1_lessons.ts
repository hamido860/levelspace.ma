import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'node:fs';

// Load .env variables
for (const envFile of ['.env', '.env.local', '.env.production.local']) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: true });
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SR_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;

if (!supabaseUrl || !supabaseKey || !geminiApiKey) {
  console.error("Missing credentials. Please ensure VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GEMINI_API_KEY are configured.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ai = new GoogleGenAI({ apiKey: geminiApiKey });

/**
 * Normalizes Arabic strings for clean search matching by stripping diacritics and unifying letters.
 */
function normalizeArabicString(str: string): string {
  return str
    .replace(/[\u064B-\u065F]/g, "") // Remove Tashkeel (diacritics)
    .replace(/[أإآ]/g, "ا")          // Unify Alifs
    .replace(/ة/g, "ه")              // Unify Ta Marbuta
    .replace(/\s+/g, "")             // Strip spaces
    .replace(/سورة/g, "")            // Strip "Surah" keyword
    .trim()
    .toLowerCase();
}

/**
 * Attempts to fetch a Surah's complete Uthmani text from api.alquran.cloud.
 */
async function fetchQuranTextForLesson(lessonTitle: string): Promise<string | null> {
  try {
    // 1. Fetch Surah list
    const listRes = await fetch('https://api.alquran.cloud/v1/surah');
    if (!listRes.ok) throw new Error("Failed to fetch Surah list");
    const listJson = await listRes.json();
    const surahs = listJson.data || [];

    const normalizedTitle = normalizeArabicString(lessonTitle);

    // 2. Find matching Surah
    const matchedSurah = surahs.find((s: any) => {
      const normName = normalizeArabicString(s.name);
      const normEnglish = s.englishName.toLowerCase().replace(/[^a-z]/g, "");
      return normName.includes(normalizedTitle) || 
             normalizedTitle.includes(normName) ||
             normEnglish.includes(normalizedTitle) ||
             normalizedTitle.includes(normEnglish);
    });

    if (!matchedSurah) {
      console.log(`📡 [Quran API] No exact Surah match found in API list for "${lessonTitle}"`);
      return null;
    }

    console.log(`📡 [Quran API] Found matching Surah inside API: "${matchedSurah.name}" (Surah #${matchedSurah.number})`);

    // 3. Fetch full Surah text (Uthmani script)
    const surahRes = await fetch(`https://api.alquran.cloud/v1/surah/${matchedSurah.number}/quran-uthmani`);
    if (!surahRes.ok) throw new Error(`Failed to fetch Surah #${matchedSurah.number}`);
    const surahJson = await surahRes.json();
    const fullSurah = surahJson.data;

    if (!fullSurah || !Array.isArray(fullSurah.ayahs)) return null;

    // 4. Format the Quran text with Uthmani script and ayah markers
    let formattedText = fullSurah.ayahs.map((ayah: any) => {
      let text = ayah.text;
      // Strip Bismillah prefix if present in middle/later surahs to prevent double rendering in layout
      if (matchedSurah.number !== 1 && matchedSurah.number !== 9 && ayah.numberInSurah === 1) {
        const bismillahPrefix = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
        if (text.startsWith(bismillahPrefix)) {
          text = text.substring(bismillahPrefix.length).trim();
        }
      }
      return `${text} ﴿${ayah.numberInSurah}﴾`;
    }).join("\n\n");

    return formattedText;
  } catch (err: any) {
    console.error(`📡 [Quran API Error] Failed to fetch Surah for "${lessonTitle}":`, err.message || err);
    return null;
  }
}

/**
 * Robustly calls the Gemini API to generate lesson content.
 * Handles rate limits (429) and network drops with infinite retries/waiting.
 */
async function callGeminiWithRetry(prompt: string, lessonTitle: string): Promise<any> {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response from Gemini.");
      }

      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseErr) {
        console.warn("Raw JSON parsing failed, attempting repair...");
        const cleanJson = responseText.substring(responseText.indexOf('{'), responseText.lastIndexOf('}') + 1);
        parsed = JSON.parse(cleanJson);
      }

      if (!parsed.content || !Array.isArray(parsed.blocks)) {
        throw new Error("Invalid output format: content or blocks array missing.");
      }

      return parsed;
    } catch (err: any) {
      const errStr = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
      console.error(`✖ [Attempt ${attempt}] Error generating lesson for "${lessonTitle}":`, errStr);

      // Check for rate limit / 429
      const isRateLimit = errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("429") || err.status === 429 || err.code === 429;
      if (isRateLimit) {
        // Attempt to parse retry delay from message (e.g. "Please retry in 41s")
        let waitSeconds = 60;
        const secondsMatch = errStr.match(/Please retry in (\d+(\.\d+)?)\s*s/i);
        if (secondsMatch && secondsMatch[1]) {
          waitSeconds = Math.ceil(parseFloat(secondsMatch[1])) + 5; // 5s buffer
        } else {
          // Check for delay in error details if it exists
          if (err.details && Array.isArray(err.details)) {
            for (const detail of err.details) {
              if (detail.retryDelay) {
                const delayMatch = String(detail.retryDelay).match(/(\d+)s/);
                if (delayMatch && delayMatch[1]) {
                  waitSeconds = parseInt(delayMatch[1]) + 5;
                  break;
                }
              }
            }
          }
        }

        console.log(`⚠️ [Rate Limit (429)] Quota reached. Sleeping for ${waitSeconds} seconds before retrying "${lessonTitle}"...`);
        await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
        continue;
      }

      // Check for network connectivity issues
      const isNetworkError = 
        errStr.includes("fetch failed") || 
        errStr.includes("ENOTFOUND") || 
        errStr.includes("EAI_AGAIN") || 
        errStr.includes("ECONNRESET") || 
        errStr.includes("ETIMEDOUT") || 
        errStr.includes("socket hang up") || 
        errStr.includes("connect") ||
        errStr.includes("network");

      if (isNetworkError) {
        console.log(`📡 [Network Offline] Unable to connect to Gemini API. Waiting 20 seconds before retrying "${lessonTitle}"...`);
        await new Promise(resolve => setTimeout(resolve, 20000));
        continue;
      }

      // Other generic errors (e.g. temporary API failure)
      const backoffSec = Math.min(10 * attempt, 60);
      console.log(`⚠️ [Temporary Error] Retrying "${lessonTitle}" in ${backoffSec} seconds...`);
      await new Promise(resolve => setTimeout(resolve, backoffSec * 1000));
    }
  }
}

async function run() {
  console.log("==================================================");
  console.log("🚀 STARTING QURAN-CONNECTED LESSON GENERATOR");
  console.log("==================================================");

  // Fetch all Grade 1 lessons from Supabase (with retry)
  let lessons: any[] = [];
  while (true) {
    try {
      console.log("Fetching Grade 1 lessons from Supabase...");
      const { data, error: lessonsError } = await supabase
        .from('lessons')
        .select('id, lesson_title, grade, subject, content, topic_id')
        .or('grade.eq.1ère année primaire,grade.eq.1 Primary,grade.eq.1AP');

      if (lessonsError) {
        throw lessonsError;
      }
      lessons = data || [];
      break;
    } catch (err: any) {
      console.error("📡 [Supabase Error] Fetch lessons failed. Retrying in 15 seconds... Details:", err.message || err);
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }

  // Filter lessons that only have starter content or are completely empty
  const emptyLessons = lessons.filter(l => 
    !l.content || 
    l.content.trim().length === 0 || 
    l.content.includes("Starter lesson shell") || 
    l.content.includes("This is not a final lesson")
  );

  console.log(`Found ${lessons.length} Grade 1 lessons total.`);
  console.log(`Targeting ${emptyLessons.length} lessons with empty/starter content for high-quality AI generation.`);
  
  if (emptyLessons.length === 0) {
    console.log("All Grade 1 lessons are already fully populated!");
    return;
  }

  const targetLessons = emptyLessons;
  console.log(`\nGenerating rich contents and interactive blocks for the following ${targetLessons.length} units:`);
  targetLessons.forEach((l, i) => console.log(`  ${i+1}. [${l.subject}] "${l.lesson_title}" (ID: ${l.id})`));

  for (const lesson of targetLessons) {
    console.log(`\n--------------------------------------------------`);
    console.log(`⏳ Processing: [${lesson.subject}] "${lesson.lesson_title}"`);
    console.log(`--------------------------------------------------`);

    // Determine if it is a Quran lesson and fetch Uthmani text from connected library API if so
    let quranText: string | null = null;
    const isQuranLesson = 
      String(lesson.subject).includes("التربية الإسلامية") || 
      String(lesson.lesson_title).startsWith("سورة") ||
      String(lesson.lesson_title).match(/^\d*سورة/);

    if (isQuranLesson) {
      console.log(`🔍 [Quran Lesson Detected] Attempting to fetch authentic Uthmani script for "${lesson.lesson_title}"...`);
      quranText = await fetchQuranTextForLesson(lesson.lesson_title);
      if (quranText) {
        console.log(`✔ [Quran API] Successfully retrieved Uthmani text (${quranText.length} characters)`);
      } else {
        console.log(`⚠️ [Quran API] Fetch failed or not a direct Surah lesson. Falling back to Gemini generation.`);
      }
    }

    const prompt = buildSubjectPrompt(lesson.subject, lesson.lesson_title, quranText || undefined);

    // Call Gemini with built-in robust offline/429 retry
    const parsed = await callGeminiWithRetry(prompt, lesson.lesson_title);

    console.log(`✔ Generation successful!`);
    console.log(`  - Content length: ${parsed.content.length} characters`);
    console.log(`  - Blocks generated: ${parsed.blocks.length} interactive sections`);

    // Update the lesson in Supabase (with retry)
    while (true) {
      try {
        console.log("Saving generated content to Supabase...");
        const { error: updateError } = await supabase
          .from('lessons')
          .update({
            content: parsed.content,
            blocks: parsed.blocks,
            subtitle: parsed.subtitle || `Interactive curriculum unit on ${lesson.lesson_title}`,
            status: 'draft',
            validation_status: 'needs_review',
            is_ai_generated: true,
            tags: ['curriculum_validated', 'interactive_g1'],
            teaching_contract: {
              status: 'needs_review',
              student_publish_allowed: false,
              rag_embedding_allowed: true,
              source: 'gemini-2.5-curriculum-generator'
            }
          })
          .eq('id', lesson.id);

        if (updateError) {
          throw updateError;
        }
        
        console.log(`✔ Successfully updated database lesson for "${lesson.lesson_title}"!`);
        break;
      } catch (updateErr: any) {
        console.error(`✖ [Supabase Save Error] Failed to save lesson "${lesson.lesson_title}". Retrying in 15 seconds... Details:`, updateErr.message || updateErr);
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    }

    // Update matching lesson_generation_jobs (with retry)
    if (lesson.topic_id) {
      while (true) {
        try {
          console.log("Updating lesson generation jobs...");
          const { error: jobError } = await supabase
            .from('lesson_generation_jobs')
            .update({
              status: 'needs_review',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              error_message: null
            })
            .eq('topic_id', lesson.topic_id)
            .eq('status', 'pending');
            
          if (jobError) {
            throw jobError;
          }
          console.log(`  (Synced lesson_generation_jobs successfully)`);
          break;
        } catch (jobErr: any) {
          console.warn(`  (Job sync warning/error: ${jobErr.message || jobErr}. Retrying in 15 seconds...)`);
          await new Promise(resolve => setTimeout(resolve, 15000));
        }
      }
    }

    // Rate-limiting delay of 4 seconds between different lessons
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  console.log("\n==================================================");
  console.log("🎉 AI LESSON GENERATION WORKER COMPLETED!");
  console.log("==================================================");
}

function buildSubjectPrompt(subject: string, title: string, quranText?: string): string {
  const isFrench = String(subject).toLowerCase() === 'français' || String(subject).toLowerCase() === 'french';
  const isMath = String(subject).toLowerCase().includes('math');
  const isSci = String(subject).toLowerCase().includes('النشاط العلمي') || String(subject).toLowerCase().includes('scientifique');
  const isIslamic = String(subject).toLowerCase().includes('التربية');

  let instruction = "";

  if (isFrench) {
    instruction = `This is a French lesson for Grade 1 Primary (1ère année primaire) in Morocco. 
    Topic: "${title}"
    Design it in clear, simple French suitable for 6-year-old beginners. Use visual markup, letter drawings (e.g. writing practices 'la lettre a'), phonics sounds, and engaging activities.`;
  } else if (isIslamic) {
    instruction = `This is an Islamic Education lesson (التربية الإسلامية) for Grade 1 Primary in Morocco.
    Topic: "${title}"
    Respond in beautiful, standard Arabic appropriate for 6-year-olds. If it's a Quranic Surah, explain the general child-friendly meanings, and focus on practical values (hygiene, honesty, respects).`;
  } else if (isSci) {
    instruction = `This is a Scientific Activity (النشاط العلمي) lesson for Grade 1 Primary in Morocco.
    Topic: "${title}"
    Respond in bilingual Moroccan primary style (Arabic text, with core scientific terms in parentheses in French - "alternance linguistique"). Focus on the five senses, animal habits, or natural states in simple, highly illustrated terms.`;
  } else if (isMath) {
    instruction = `This is a Mathematics (Mathématiques) lesson for Grade 1 Primary in Morocco.
    Topic: "${title}"
    Respond in alternating bilingual style (التعليم بالتناوب - Arabic numbers and descriptions, but incorporating French terms like 'les numbers', 'l'addition'). Focus on counting, basic geometric shapes, or sums.`;
  } else {
    instruction = `This is an educational lesson for Grade 1 Primary in Morocco. Topic: "${title}". Respond in clear child-friendly language.`;
  }

  if (quranText) {
    instruction += `
    
    CRITICAL Pedagogical Obligation (MANDATORY):
    You MUST include this EXACT, pristine Uthmani Arabic script for the Surah recitation block in your lesson:
    "${quranText}"
    
    Ensure it is displayed beautifully in the introduction and core explanation blocks using appropriate styling.
    Do not modify any words, diacritics, or punctuation of the scripture!`;
  }

  return `
  You are a premium curriculum content generator specializing in the Moroccan primary education system (1ère année primaire / 1 A.P.).
  Your task is to generate a comprehensive, highly illustrated, and extremely professional educational lesson on:
  - Subject: "${subject}"
  - Topic: "${title}"

  ${instruction}

  You must structure your response as a valid JSON object matching the schema below. Do not output any surrounding text other than the JSON.

  JSON Schema:
  {
    "subtitle": "Short, catchy sub-headline (max 80 chars) describing the lesson goals in standard child-friendly language.",
    "content": "A detailed, beautiful markdown-formatted curriculum lesson. Use standard headers, bullet points, bold keywords, simple vocabulary, and short paragraphs suitable for Grade 1.",
    "blocks": [
      {
        "type": "text",
        "title": "Welcome / Introduction Section",
        "content": "Warm introductory child-friendly text to capture the student's curiosity."
      },
      {
        "type": "text",
        "title": "Core Concept / Explanation",
        "content": "The main lesson teaching content explained in simple child-friendly words."
      },
      {
        "type": "example",
        "title": "Fun Activity / Example",
        "content": "Provide a simple, visual, step-by-step example (e.g. 'Let's count: 🍎, 🍎, 🍎 = 3 apples!')."
      },
      {
        "type": "summary",
        "title": "Unit Review / Recap",
        "content": "A very simple, highlighted recap of what the child learned in this unit."
      },
      {
        "type": "quiz",
        "title": "Interactive Multi-Choice Question",
        "question": "A simple multiple-choice question to test comprehension.",
        "quiz": {
          "question": "Simple question string",
          "options": ["Option A", "Option B", "Option C"],
          "answer": "The exact correct option string from the options array",
          "hint": "Child-friendly hint to help them think"
        }
      },
      {
        "type": "exercise",
        "title": "Fill-in-the-Blank or Writing Exercise",
        "question": "A writing prompt or open question.",
        "exercise": {
          "question": "Question/Prompt string",
          "hint": "Helpful pedagogical hint",
          "answer": "The expected word or short sentence answer"
        }
      }
    ]
  }
  `;
}

run().catch(console.error);
