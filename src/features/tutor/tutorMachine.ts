import type { DifficultyType, QuizQuestion, TutorContext, TutorEvent, TutorMode, TutorUIInstruction } from './types';

export const createInitialTutorContext = (input: Partial<TutorContext> = {}): TutorContext => {
  const mode = input.currentMode || input.uiMode || 'reading_mode';
  return {
    lessonId: input.lessonId,
    topicId: input.topicId,
    currentSectionTitle: input.currentSectionTitle,
    currentSectionText: input.currentSectionText,
    selectedBlockType: input.selectedBlockType,
    currentMode: mode,
    uiMode: mode,
    currentQuestion: input.currentQuestion,
    lastStudentAnswer: input.lastStudentAnswer,
    lastFeedback: input.lastFeedback,
    attempts: input.attempts ?? 0,
    masteryScore: input.masteryScore ?? 0,
    lastEvent: input.lastEvent,
  };
};

const blockMode: Record<DifficultyType, TutorMode> = {
  mots: 'vocabulary_diagnostic_mode',
  phrase: 'sentence_diagnostic_mode',
  idee: 'explanation_mode',
  exemple: 'example_mode',
  etapes: 'explanation_mode',
  pas_sur: 'diagnostic_mode',
};

const withMode = (
  context: TutorContext,
  event: TutorEvent,
  currentMode: TutorMode,
  patch: Partial<TutorContext> = {},
): TutorContext => ({
  ...context,
  ...patch,
  currentMode,
  uiMode: currentMode,
  lastEvent: event.type,
});

export function tutorReducer(context: TutorContext, event: TutorEvent): TutorContext {
  switch (event.type) {
    case 'ASK_HELP':
      return withMode(context, event, 'diagnostic_mode', {
        currentSectionTitle: event.sectionTitle ?? context.currentSectionTitle,
        currentSectionText: event.sectionText ?? context.currentSectionText,
        lastFeedback: 'On va trouver le blocage exact. Choisis ce qui bloque le plus.',
      });
    case 'SELECT_BLOCK':
      return withMode(context, event, blockMode[event.value], {
        selectedBlockType: event.value,
        lastFeedback: buildBlockFeedback(event.value),
      });
    case 'REQUEST_EXAMPLE':
      return withMode(context, event, 'example_mode', {
        lastFeedback: buildExampleText(context.currentSectionTitle),
      });
    case 'REQUEST_EXPLANATION':
      return withMode(context, event, 'explanation_mode');
    case 'START_QUIZ':
      return withMode(context, event, 'quiz_mode', {
        currentQuestion: event.question,
        lastStudentAnswer: undefined,
      });
    case 'SUBMIT_ANSWER':
      return withMode(context, event, 'quiz_mode', {
        lastStudentAnswer: event.answer,
        attempts: context.attempts + 1,
      });
    case 'ANSWER_CORRECT':
      return withMode(context, event, 'quiz_mode', {
        masteryScore: Math.min(100, context.masteryScore + 20),
        lastFeedback: event.feedback,
      });
    case 'ANSWER_WRONG':
      return withMode(context, event, 'repair_mode', {
        masteryScore: Math.max(0, context.masteryScore - 5),
        lastFeedback: event.feedback,
      });
    case 'NEED_REPAIR':
      return withMode(context, event, 'repair_mode', {
        lastFeedback: event.feedback,
      });
    case 'SUMMARIZE':
      return withMode(context, event, 'summary_mode');
    case 'RESET_TO_READING':
      return withMode(context, event, 'reading_mode', {
        selectedBlockType: undefined,
        lastStudentAnswer: undefined,
        lastFeedback: undefined,
      });
    default:
      return context;
  }
}

export function applyTutorInstruction(context: TutorContext, instruction: TutorUIInstruction): TutorContext {
  if (instruction.event === 'SELECT_BLOCK' && instruction.selectedBlockType) {
    return tutorReducer(context, { type: 'SELECT_BLOCK', value: instruction.selectedBlockType });
  }
  if (instruction.event === 'ASK_HELP') return tutorReducer(context, { type: 'ASK_HELP' });
  if (instruction.event === 'REQUEST_EXAMPLE') return tutorReducer(context, { type: 'REQUEST_EXAMPLE' });
  if (instruction.event === 'REQUEST_EXPLANATION') return tutorReducer(context, { type: 'REQUEST_EXPLANATION' });
  if (instruction.event === 'START_QUIZ') return tutorReducer(context, { type: 'START_QUIZ', question: instruction.question });
  if (instruction.event === 'NEED_REPAIR') return tutorReducer(context, { type: 'NEED_REPAIR', feedback: instruction.assistantText });
  if (instruction.event === 'SUMMARIZE') return tutorReducer(context, { type: 'SUMMARIZE' });
  if (instruction.event === 'RESET_TO_READING') return tutorReducer(context, { type: 'RESET_TO_READING' });
  return context;
}

export const createFallbackQuizQuestion = (title?: string): QuizQuestion => ({
  question_text: title ? `Dans "${title}", que sert a identifier le verbe ?` : 'Que sert a identifier le verbe ?',
  question_type: 'mcq_single',
  options: ['Une action ou un etat', 'La couleur du texte', 'Le numero de page', 'Le titre du fichier'],
  correct_answer: 'Une action ou un etat',
  hint: "Cherche ce que le verbe indique dans la phrase.",
  explanation: "Le verbe indique souvent une action, une action subie, ou un etat.",
  skill_code: 'verb_identification',
  difficulty: 1,
});

export function buildBlockFeedback(value: DifficultyType): string {
  if (value === 'mots') return "D'accord. On va travailler les mots. Dans cette section, quel mot bloque le plus ?";
  if (value === 'phrase') return "Choisis la phrase qui bloque, ou colle-la ici. Je vais la reformuler simplement.";
  if (value === 'idee') return "On va chercher l'idee principale. Cette section parle surtout du role du verbe, de ses formes, ou de ses types ?";
  if (value === 'exemple') return buildExampleText();
  if (value === 'etapes') {
    return "On va faire etape par etape : 1. trouver le verbe, 2. voir ce qu'il exprime, 3. dire s'il est d'action ou d'etat. Commencons : dans cette phrase, quel mot montre l'action ?";
  }
  return "Pas de probleme. Quand tu lis cette section, qu'est-ce qui arrive ? A. Je ne comprends pas les mots. B. Je comprends les mots mais pas l'idee. C. Je comprends l'idee mais pas les exemples.";
}

export function buildExampleText(sectionTitle?: string): string {
  const intro = sectionTitle ? `Exemple simple pour "${sectionTitle}" :` : 'Exemple simple :';
  return `${intro}

L'eleve ecrit la lecon.

Le verbe est **ecrit**, parce qu'il montre l'action faite par l'eleve.

A toi : dans **Le garcon court**, quel est le verbe ?`;
}
