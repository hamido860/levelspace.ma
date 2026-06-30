import type { TutorEvent, TutorMode, TutorUIInstruction } from './types';

const TUTOR_MODES: TutorMode[] = [
  'reading_mode',
  'diagnostic_mode',
  'vocabulary_diagnostic_mode',
  'sentence_diagnostic_mode',
  'example_mode',
  'explanation_mode',
  'quiz_mode',
  'repair_mode',
  'summary_mode',
];

const INTERNAL_TERMS = [
  'rag',
  'embedding',
  'embeddings',
  'chunk',
  'chunks',
  'supabase',
  'metadata',
  'vector search',
  'tool call',
  'system prompt',
  'confidence score',
];

export function sanitizeTutorText(text: string): string {
  const withoutSpeakerLabels = text
    .replace(/^\s*(Tutor|Assistant|Student)\s*:\s*/i, '')
    .replace(/\n\s*(Tutor|Assistant|Student)\s*:\s*/gi, '\n');

  return INTERNAL_TERMS.reduce((clean, term) => {
    const pattern = new RegExp(term.replace(/\s+/g, '\\s+'), 'gi');
    return clean.replace(pattern, 'lesson context');
  }, withoutSpeakerLabels);
}

export function mapStudentIntentToTutorEvent(message: string): TutorEvent | null {
  const text = message.toLowerCase();

  if (
    text.includes("j'ai besoin d'un exemple") ||
    text.includes('besoin d un exemple') ||
    text.includes('un exemple') ||
    text.includes('show example') ||
    text.includes('give me an example')
  ) {
    return { type: 'REQUEST_EXAMPLE' };
  }

  if (
    text.includes('aide-moi') ||
    text.includes('aide moi') ||
    text.includes('ce qui est difficile') ||
    text.includes('ce qui bloque') ||
    text.includes('help me find') ||
    text.includes('what is difficult')
  ) {
    return { type: 'ASK_HELP' };
  }

  if (
    text.includes('quiz me') ||
    text.includes('donne-moi un quiz') ||
    text.includes('donne moi un quiz') ||
    text.includes('start quiz') ||
    text.includes('test my understanding')
  ) {
    return { type: 'START_QUIZ' };
  }

  if (
    text.includes('resume') ||
    text.includes('résume') ||
    text.includes('summary') ||
    text.includes('summarize') ||
    text.includes('recap')
  ) {
    return { type: 'SUMMARIZE' };
  }

  return null;
}

export function validateTutorUIInstruction(raw: unknown): TutorUIInstruction | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.ui_mode !== 'string' || !TUTOR_MODES.includes(candidate.ui_mode as TutorMode)) {
    return null;
  }

  const instruction: TutorUIInstruction = {
    ui_mode: candidate.ui_mode as TutorMode,
    event: typeof candidate.event === 'string' ? candidate.event as TutorUIInstruction['event'] : 'REQUEST_EXPLANATION',
    selectedBlockType: typeof candidate.selectedBlockType === 'string'
      ? candidate.selectedBlockType as TutorUIInstruction['selectedBlockType']
      : undefined,
    studentText: typeof candidate.studentText === 'string' ? candidate.studentText : '',
    assistantText: typeof candidate.assistantText === 'string' ? candidate.assistantText : '',
    card: typeof candidate.card === 'string' ? candidate.card as TutorUIInstruction['card'] : undefined,
    options: Array.isArray(candidate.options)
      ? candidate.options
          .filter((option): option is { label: string; value: string } => {
            if (!option || typeof option !== 'object') return false;
            const record = option as Record<string, unknown>;
            return typeof record.label === 'string' && typeof record.value === 'string';
          })
          .map((option) => ({ label: option.label, value: option.value }))
      : undefined,
  };

  if (candidate.question && typeof candidate.question === 'object') {
    const question = candidate.question as Record<string, unknown>;
    if (
      typeof question.question_text === 'string' &&
      (
        question.question_type === 'mcq_single' ||
        question.question_type === 'short_answer' ||
        question.question_type === 'true_false' ||
        question.question_type === 'fill_blank'
      )
    ) {
      instruction.question = {
        question_text: question.question_text,
        question_type: question.question_type,
        options: Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === 'string') : undefined,
        correct_answer: typeof question.correct_answer === 'string' ? question.correct_answer : undefined,
        hint: typeof question.hint === 'string' ? question.hint : undefined,
        explanation: typeof question.explanation === 'string' ? question.explanation : undefined,
        difficulty: typeof question.difficulty === 'number' ? question.difficulty : undefined,
        skill_code: typeof question.skill_code === 'string' ? question.skill_code : undefined,
        misconception_tag: typeof question.misconception_tag === 'string' ? question.misconception_tag : undefined,
      };
    }
  }

  if (instruction.ui_mode === 'quiz_mode' && !instruction.question) return null;
  return instruction;
}

export function extractTutorInstruction(responseText: string): { instruction: TutorUIInstruction | null; displayText: string } {
  const markerMatch = responseText.match(/<tutor-ui>([\s\S]*?)<\/tutor-ui>/i);
  if (!markerMatch) {
    return { instruction: null, displayText: sanitizeTutorText(responseText) };
  }

  try {
    const parsed = JSON.parse(markerMatch[1]);
    const instruction = validateTutorUIInstruction(parsed);
    if (!instruction) {
      if (import.meta.env.DEV) console.warn('[TutorUI] Invalid assistant UI instruction', parsed);
      return { instruction: null, displayText: sanitizeTutorText(responseText.replace(markerMatch[0], '').trim()) };
    }
    return {
      instruction,
      displayText: sanitizeTutorText(responseText.replace(markerMatch[0], '').trim()),
    };
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[TutorUI] Failed to parse assistant UI instruction', error);
    return { instruction: null, displayText: sanitizeTutorText(responseText.replace(markerMatch[0], '').trim()) };
  }
}
