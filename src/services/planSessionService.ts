import { db } from '../db/db';
import { callNvidiaAPI } from './geminiService';
import { jsonrepair } from 'jsonrepair';
import { differenceInDays, format } from 'date-fns';

export interface SessionBlock {
  subject: string;
  lessonTitle: string;
  lessonId?: string;
  duration: number; // minutes
  type: 'warmup' | 'deep_work' | 'review' | 'break' | 'practice';
  tip?: string;
}

export interface SessionPlan {
  greeting: string;
  blocks: SessionBlock[];
  totalMinutes: number;
  close: string;
}

export interface ModuleAudit {
  moduleId: string;
  moduleName: string;
  total: number;
  done: number;
  pending: { id: string; title: string }[];
  examLabel?: string;       // e.g. "Exam in 3 days (May 20)"
  examDaysAway?: number;
  urgencyScore: number;     // higher = more urgent
}

/** Compute per-module lesson audit + nearest upcoming exam */
export async function computeAudit(): Promise<ModuleAudit[]> {
  const [allModules, lessons, tasks] = await Promise.all([
    db.modules.toArray(),
    db.lessons.toArray(),
    db.tasks.toArray(),
  ]);
  const modules = allModules.filter(m => m.selected);

  const today = new Date();

  const audits: ModuleAudit[] = modules.map(m => {
    const mLessons = lessons.filter(l => l.moduleId === m.id && (l.status === 'done' || l.status === 'active' || l.status === 'pending'));
    const done = mLessons.filter(l => l.status === 'done').length;
    const pending = mLessons
      .filter(l => l.status !== 'done')
      .map(l => ({ id: l.id, title: l.title }))
      .slice(0, 6); // limit to 6 for prompt

    // Find nearest exam/controle linked to this module by name matching
    const exam = tasks
      .filter(t => !t.completed && t.dueDate && (t.type === 'exam' || t.type === 'controle'))
      .filter(t => t.title.toLowerCase().includes(m.name.toLowerCase().split(' ')[0].toLowerCase()))
      .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0];

    let examLabel: string | undefined;
    let examDaysAway: number | undefined;
    if (exam?.dueDate) {
      examDaysAway = differenceInDays(new Date(exam.dueDate), today);
      if (examDaysAway >= 0) {
        examLabel = `${exam.type === 'exam' ? 'Exam' : 'Controle'} in ${examDaysAway} day${examDaysAway === 1 ? '' : 's'} (${format(new Date(exam.dueDate), 'MMM d')})`;
      }
    }

    // Urgency: closer exam + more pending lessons = higher score
    const examUrgency = examDaysAway != null && examDaysAway <= 14 ? (14 - examDaysAway) * 5 : 0;
    const pendingUrgency = pending.length * 3;
    const progressUrgency = mLessons.length > 0 ? (1 - done / mLessons.length) * 10 : 0;
    const urgencyScore = examUrgency + pendingUrgency + progressUrgency;

    return {
      moduleId: m.id,
      moduleName: m.name,
      total: mLessons.length,
      done,
      pending,
      examLabel,
      examDaysAway,
      urgencyScore,
    };
  });

  return audits.sort((a, b) => b.urgencyScore - a.urgencyScore);
}

/** Build a rule-based fallback plan (no AI needed) */
function buildFallbackPlan(audits: ModuleAudit[], availableMinutes: number): SessionPlan {
  const urgent = audits.filter(a => a.pending.length > 0);
  const blocks: SessionBlock[] = [];
  let remaining = availableMinutes;

  if (urgent.length === 0) {
    return {
      greeting: "You're all caught up! Great job staying on top of your lessons.",
      blocks: [{ subject: 'General review', lessonTitle: 'Review your notes', duration: availableMinutes, type: 'review' }],
      totalMinutes: availableMinutes,
      close: "Keep the momentum going!",
    };
  }

  const primary = urgent[0];
  const secondary = urgent[1];

  // Warm-up from secondary (if exists)
  if (secondary && secondary.pending[0] && remaining >= 15) {
    const dur = Math.min(15, Math.floor(remaining * 0.25));
    blocks.push({ subject: secondary.moduleName, lessonTitle: secondary.pending[0].title, lessonId: secondary.pending[0].id, duration: dur, type: 'warmup', tip: 'Light warm-up — just read through the lesson.' });
    remaining -= dur;
  }

  // Deep work on primary
  if (primary.pending[0] && remaining >= 20) {
    const dur = Math.min(25, Math.floor(remaining * 0.45));
    blocks.push({ subject: primary.moduleName, lessonTitle: primary.pending[0].title, lessonId: primary.pending[0].id, duration: dur, type: 'deep_work', tip: 'Study the concepts deeply — take notes.' });
    remaining -= dur;
  }

  // Break
  if (remaining >= 10) {
    blocks.push({ subject: '', lessonTitle: 'Break', duration: 5, type: 'break', tip: 'Stand up, hydrate, rest your eyes.' });
    remaining -= 5;
  }

  // Second lesson of primary
  if (primary.pending[1] && remaining >= 15) {
    blocks.push({ subject: primary.moduleName, lessonTitle: primary.pending[1].title, lessonId: primary.pending[1].id, duration: remaining, type: 'practice', tip: 'Work through exercises or self-quiz.' });
    remaining = 0;
  }

  const total = blocks.reduce((s, b) => s + b.duration, 0);
  return {
    greeting: primary.examLabel
      ? `You have ${primary.pending.length} lessons left in ${primary.moduleName} — and ${primary.examLabel}. Let's make this session count.`
      : `You have ${primary.pending.length} unrevised lessons in ${primary.moduleName}. Here's a focused plan:`,
    blocks,
    totalMinutes: total,
    close: "Consistent sessions like this are what move the needle. Let's go.",
  };
}

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  fr: 'French (Français)',
  ar: 'Modern Standard Arabic (العربية الفصحى)',
  dr: 'Moroccan Darija (دارجة مغربية)',
};

/** Build the AI prompt from real audit data */
function buildPrompt(audits: ModuleAudit[], userMessage: string, availableMinutes: number, lang = 'en'): string {
  const moduleLines = audits.map(a => {
    const pendingStr = a.pending.map(p => `    - "${p.title}" (id: ${p.id})`).join('\n');
    const examStr = a.examLabel ? `\n  → ${a.examLabel}` : '';
    return `• ${a.moduleName}: ${a.done}/${a.total} lessons done, ${a.pending.length} not yet revised${examStr}\n  Pending lessons:\n${pendingStr || '    (none)'}`;
  }).join('\n\n');

  const langName = LANG_NAMES[lang] ?? 'English';

  return `You are a smart study coach for a Moroccan high-school student.

IMPORTANT: Respond ENTIRELY in ${langName}. Every field in the JSON (greeting, lessonTitle, tip, close) must be written in ${langName}. Do NOT mix languages.

STUDENT'S CURRENT STATE:
${moduleLines}

USER MESSAGE: "${userMessage}"
AVAILABLE TIME: ${availableMinutes} minutes

Generate a personalized study session plan.

Rules:
- Reference REAL pending lesson titles from the data above — do not invent lesson names
- Prioritize subjects with upcoming exams first
- Include a short break if session > 40 minutes
- Keep tips short, specific, and actionable (1 sentence)
- The greeting must mention actual numbers (e.g. "5 of 8 lessons") and the exam if one exists
- Total block durations must sum to approximately ${availableMinutes} minutes

Respond with ONLY valid JSON in this exact shape:
{
  "greeting": "...",
  "blocks": [
    {
      "subject": "Mathematics",
      "lessonTitle": "Exact lesson title from data",
      "lessonId": "exact-id-from-data-or-empty-string",
      "duration": 25,
      "type": "deep_work",
      "tip": "One sentence actionable tip"
    }
  ],
  "totalMinutes": ${availableMinutes},
  "close": "Short motivational closing sentence"
}

Valid types: warmup, deep_work, review, break, practice`;
}

/** Main entry — returns a session plan */
export async function generateSessionPlan(
  userMessage: string,
  availableMinutes: number,
  lang = 'en',
): Promise<{ plan: SessionPlan; audits: ModuleAudit[] }> {
  const audits = await computeAudit();

  try {
    const prompt = buildPrompt(audits, userMessage, availableMinutes, lang);
    const raw = await callNvidiaAPI({ prompt, isJson: true, temperature: 0.5, maxTokens: 1200 });

    if (raw) {
      const repaired = jsonrepair(raw);
      const parsed = JSON.parse(repaired) as SessionPlan;
      if (parsed.blocks?.length > 0) {
        return { plan: parsed, audits };
      }
    }
  } catch (err) {
    console.warn('[planSessionService] AI call failed, using fallback:', err);
  }

  return { plan: buildFallbackPlan(audits, availableMinutes), audits };
}
