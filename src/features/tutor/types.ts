export type TutorMode =
  | 'reading_mode'
  | 'diagnostic_mode'
  | 'vocabulary_diagnostic_mode'
  | 'sentence_diagnostic_mode'
  | 'example_mode'
  | 'explanation_mode'
  | 'quiz_mode'
  | 'repair_mode'
  | 'summary_mode';

export type DifficultyType = 'mots' | 'phrase' | 'idee' | 'exemple' | 'etapes' | 'pas_sur';

export type TutorInstructionEvent =
  | 'ASK_HELP'
  | 'SELECT_BLOCK'
  | 'REQUEST_EXAMPLE'
  | 'REQUEST_EXPLANATION'
  | 'START_QUIZ'
  | 'SUBMIT_ANSWER'
  | 'NEED_REPAIR'
  | 'SUMMARIZE'
  | 'RESET_TO_READING';

export type QuizQuestionType = 'mcq_single' | 'short_answer' | 'true_false' | 'fill_blank';

export interface QuizQuestion {
  question_text: string;
  question_type: QuizQuestionType;
  options?: string[];
  correct_answer?: string;
  hint?: string;
  explanation?: string;
  skill_code?: string;
  difficulty?: number;
  misconception_tag?: string;
}

export interface TutorUIInstruction {
  ui_mode: TutorMode;
  event: TutorInstructionEvent;
  selectedBlockType?: DifficultyType;
  studentText: string;
  assistantText: string;
  card?:
    | 'diagnostic_selector'
    | 'vocabulary_selector'
    | 'sentence_selector'
    | 'quiz_card'
    | 'repair_card'
    | 'summary_card';
  options?: Array<{
    label: string;
    value: string;
  }>;
  question?: QuizQuestion;
}

export interface StudentAnswerResult {
  isCorrect: boolean;
  isPartial?: boolean;
  feedback: string;
  hint?: string;
}

export interface TutorContext {
  lessonId?: string;
  topicId?: string;
  currentSectionTitle?: string;
  currentSectionText?: string;
  selectedBlockType?: DifficultyType;
  currentMode: TutorMode;
  uiMode: TutorMode;
  currentQuestion?: QuizQuestion;
  lastStudentAnswer?: string;
  lastFeedback?: string;
  attempts: number;
  masteryScore: number;
  lastEvent?: TutorEvent['type'];
}

export type TutorEvent =
  | { type: 'ASK_HELP'; sectionTitle?: string; sectionText?: string }
  | { type: 'SELECT_BLOCK'; value: DifficultyType }
  | { type: 'REQUEST_EXAMPLE' }
  | { type: 'REQUEST_EXPLANATION' }
  | { type: 'START_QUIZ'; question?: QuizQuestion }
  | { type: 'SUBMIT_ANSWER'; answer: string }
  | { type: 'ANSWER_CORRECT'; feedback: string }
  | { type: 'ANSWER_WRONG'; feedback: string }
  | { type: 'NEED_REPAIR'; feedback: string }
  | { type: 'SUMMARIZE' }
  | { type: 'RESET_TO_READING' };
