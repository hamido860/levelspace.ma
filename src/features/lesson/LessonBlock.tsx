import React, { useState } from 'react';
import { CheckCircle2, Dumbbell, FileText, FlaskConical, HelpCircle, Lightbulb, ListChecks, PenTool, Target, XCircle, ChevronDown, ChevronUp, Brain } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { DisplayedLessonBlock, PedagogicalPurpose } from './useDisplayedLessonBlocks';

const markdownPlugins = {
  remarkPlugins: [remarkMath],
  rehypePlugins: [[rehypeKatex, { strict: false }]] as any,
};

const PURPOSE_ICONS: Record<PedagogicalPurpose, React.ElementType> = {
  objective: Target,
  definition: FileText,
  key_idea: Lightbulb,
  explanation: FileText,
  example: FlaskConical,
  practice: Dumbbell,
  quiz: HelpCircle,
  exam: PenTool,
  summary: ListChecks,
};

const PURPOSE_COLORS: Record<PedagogicalPurpose, { bg: string; text: string }> = {
  objective: { bg: 'bg-accent/10', text: 'text-accent' },
  definition: { bg: 'bg-success/10', text: 'text-success' },
  key_idea: { bg: 'bg-gold/10', text: 'text-gold' },
  explanation: { bg: 'bg-accent/10', text: 'text-accent' },
  example: { bg: 'bg-warning/10', text: 'text-warning' },
  practice: { bg: 'bg-success/10', text: 'text-success' },
  quiz: { bg: 'bg-accent/10', text: 'text-accent' },
  exam: { bg: 'bg-warning/10', text: 'text-warning' },
  summary: { bg: 'bg-accent/10', text: 'text-accent' },
};

type LessonBlockProps = {
  item: DisplayedLessonBlock;
  isViewed: boolean;
  reading: boolean;
  quizAnswered: Record<number, boolean>;
  quizCorrect: Record<number, boolean>;
  quizSelectedOption: Record<number, string>;
  exerciseResult: Record<number, 'correct' | 'wrong' | 'shown' | null>;
  exerciseHintShown: Record<number, boolean>;
  examResult: Record<number, 'correct' | 'wrong' | 'shown' | null>;
  examHintShown: Record<number, boolean>;
  onQuizAnswer: (sourceIndex: number, option: string, correctAnswer: string) => void;
  onExerciseSubmit: (sourceIndex: number, solution: string) => void;
  onShowExerciseHint: (sourceIndex: number) => void;
  onExamSubmit: (sourceIndex: number, solution: string) => void;
  onShowExamHint: (sourceIndex: number) => void;
};

const getContentText = (block: any) =>
  [
    block?.content,
    block?.question,
    block?.quiz?.question,
    block?.exercise?.question,
    block?.exercise?.prompt,
    block?.exam?.question,
  ].filter(Boolean).join('\n\n');

const MarkdownText: React.FC<{ children?: string }> = ({ children }) => (
  <div className="prose prose-slate max-w-none text-ink prose-p:leading-8 prose-li:leading-8 prose-headings:text-ink prose-strong:text-ink">
    <ReactMarkdown {...markdownPlugins}>{children || ''}</ReactMarkdown>
  </div>
);

const SolutionPanel: React.FC<{ title?: string; content?: string }> = ({ title = 'Solution', content }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="p-4 rounded-2xl bg-surface-low border border-surface-mid"
  >
    <div className="flex items-start gap-3">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">{title}</p>
        <MarkdownText>{content || ''}</MarkdownText>
      </div>
    </div>
  </motion.div>
);

export const LessonBlock: React.FC<LessonBlockProps> = ({
  item,
  isViewed,
  reading,
  quizAnswered,
  quizCorrect,
  quizSelectedOption,
  exerciseResult,
  exerciseHintShown,
  examResult,
  examHintShown,
  onQuizAnswer,
  onExerciseSubmit,
  onShowExerciseHint,
  onExamSubmit,
  onShowExamHint,
}) => {
  const block = item.block || {};
  const sourceIndex = item.sourceIndex;
  const Icon = PURPOSE_ICONS[item.purpose];
  const colors = PURPOSE_COLORS[item.purpose];
  const contentText = getContentText(block);
  const quiz = block.quiz || (block.type === 'quiz' && block.question ? {
    question: block.question,
    options: block.options,
    correctAnswer: block.correctAnswer,
    explanation: block.explanation,
  } : null);
  const exercise = block.exercise || (block.type === 'exercise' ? {
    question: block.content || block.question,
    hint: block.hint,
    solution: block.solution,
  } : null);
  const exam = block.exam || (block.type === 'exam' ? {
    question: block.content || block.question,
    hint: block.hint,
    solution: block.solution,
    source: block.source,
  } : null);

  return (
    <article id={item.id} className="bg-paper border border-surface-mid rounded-3xl p-6 md:p-8 shadow-sm scroll-mt-28 space-y-6">
      {/* Block Header */}
      <header className="flex items-start gap-4">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${colors.bg} ${colors.text}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-[0.1em] mb-1">{item.label}</p>
          <h2 className="text-xl md:text-2xl font-bold text-ink leading-snug">{item.title}</h2>
        </div>
        <span className={`hidden md:inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-normal shrink-0 ${
          isViewed ? 'bg-success/10 text-success' : 'bg-surface-mid text-ink-muted'
        }`}>
          {isViewed ? 'Viewed' : 'New'}
        </span>
      </header>

      {/* Reading State Indicator */}
      {reading && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          Reading this section aloud
        </div>
      )}

      {/* Main Content */}
      {contentText && !quiz && !exercise && !exam && (
        <div className="prose prose-slate max-w-none">
          <MarkdownText>{contentText}</MarkdownText>
        </div>
      )}

      {/* Points List */}
      {Array.isArray(block.points) && block.points.length > 0 && (
        <ul className="space-y-3 pl-5">
          {block.points.map((point: string, index: number) => (
            <li key={index} className="list-disc text-ink">
              <MarkdownText>{point}</MarkdownText>
            </li>
          ))}
        </ul>
      )}

      {/* Rules List */}
      {Array.isArray(block.rules) && block.rules.length > 0 && (
        <ul className="space-y-3 pl-5">
          {block.rules.map((rule: string, index: number) => (
            <li key={index} className="list-disc text-ink">
              <MarkdownText>{rule}</MarkdownText>
            </li>
          ))}
        </ul>
      )}

      {/* Examples */}
      {Array.isArray(block.examples) && block.examples.length > 0 && (
        <div className="space-y-4">
          {block.examples.map((example: any, index: number) => (
            <div key={index} className="rounded-2xl bg-surface-low p-4 space-y-3">
              {example.question && <MarkdownText>{example.question}</MarkdownText>}
              {Array.isArray(example.steps) && example.steps.map((step: string, stepIndex: number) => (
                <div key={stepIndex} className="mt-3 rounded-xl bg-paper p-4">
                  <MarkdownText>{step}</MarkdownText>
                </div>
              ))}
              {example.answer && <SolutionPanel title="Answer" content={example.answer} />}
            </div>
          ))}
        </div>
      )}

      {/* Quiz */}
      {quiz && Array.isArray(quiz.options) && (
        <div className="rounded-2xl bg-surface-low p-6 space-y-4">
          <MarkdownText>{quiz.question}</MarkdownText>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quiz.options.map((option: string, optionIndex: number) => {
              const answered = quizAnswered[sourceIndex];
              const selected = quizSelectedOption[sourceIndex] === option;
              const correct = option === quiz.correctAnswer;
              return (
                <button
                  key={optionIndex}
                  type="button"
                  disabled={answered}
                  onClick={() => onQuizAnswer(sourceIndex, option, quiz.correctAnswer)}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all ${
                    answered && correct 
                      ? 'border-success bg-success/10 text-success' 
                      : answered && selected && !correct 
                      ? 'border-error bg-error/10 text-error'
                      : 'border-surface-mid bg-paper text-ink hover:border-surface-mid hover:bg-surface-low disabled:cursor-default'
                  }`}
                >
                  <span><MarkdownText>{option}</MarkdownText></span>
                  {answered && correct && <CheckCircle2 size={18} />}
                  {answered && selected && !correct && <XCircle size={18} />}
                </button>
              );
            })}
          </div>
          <AnimatePresence>
            {quizAnswered[sourceIndex] && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className={`mt-4 rounded-2xl p-4 text-sm font-medium ${
                  quizCorrect[sourceIndex] ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                }`}
              >
                <strong>{quizCorrect[sourceIndex] ? 'Correct!' : 'Review this concept.'}</strong>
                {quiz.explanation && (
                  <div className="mt-2">
                    <MarkdownText>{quiz.explanation}</MarkdownText>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Exercise */}
      {exercise && (
        <div className="rounded-2xl bg-surface-low p-6 space-y-4">
          <MarkdownText>{exercise.question || exercise.prompt}</MarkdownText>
          <div className="flex flex-col sm:flex-row gap-3">
            {exercise.hint && (
              <button 
                type="button" 
                onClick={() => onShowExerciseHint(sourceIndex)} 
                className="px-6 py-3 rounded-xl border border-surface-mid bg-paper text-ink font-medium text-sm hover:bg-surface-low transition-all"
              >
                {exerciseHintShown[sourceIndex] ? 'Hint shown' : 'Show hint'}
              </button>
            )}
            <button 
              type="button" 
              onClick={() => onExerciseSubmit(sourceIndex, exercise.solution || '')} 
              className="px-6 py-3 rounded-xl bg-ink text-paper font-medium text-sm hover:bg-accent transition-all flex items-center justify-center gap-2"
            >
              <Target size={16} />
              Show solution
            </button>
          </div>
          {exerciseHintShown[sourceIndex] && exercise.hint && (
            <div className="rounded-xl bg-paper p-4">
              <p className="text-xs font-bold text-accent uppercase tracking-normal mb-2 flex items-center gap-2">
                <Brain size={12} />
                Hint
              </p>
              <MarkdownText>{exercise.hint}</MarkdownText>
            </div>
          )}
          {exerciseResult[sourceIndex] && <SolutionPanel content={exercise.solution} />}
        </div>
      )}

      {/* Exam */}
      {exam && (
        <div className="rounded-2xl bg-warning/5 p-6 space-y-4 border border-warning/20">
          {exam.source && <p className="text-xs font-bold text-ink-muted uppercase tracking-[0.1em]">{exam.source}</p>}
          <MarkdownText>{exam.question}</MarkdownText>
          <div className="flex flex-col sm:flex-row gap-3">
            {exam.hint && (
              <button 
                type="button" 
                onClick={() => onShowExamHint(sourceIndex)} 
                className="px-6 py-3 rounded-xl border border-surface-mid bg-paper text-ink font-medium text-sm hover:bg-surface-low transition-all"
              >
                {examHintShown[sourceIndex] ? 'Hint shown' : 'Show hint'}
              </button>
            )}
            <button 
              type="button" 
              onClick={() => onExamSubmit(sourceIndex, exam.solution || '')} 
              className="px-6 py-3 rounded-xl bg-ink text-paper font-medium text-sm hover:bg-accent transition-all flex items-center justify-center gap-2"
            >
              <Target size={16} />
              Show solution
            </button>
          </div>
          {examHintShown[sourceIndex] && exam.hint && (
            <div className="rounded-xl bg-paper p-4">
              <p className="text-xs font-bold text-accent uppercase tracking-normal mb-2 flex items-center gap-2">
                <Brain size={12} />
                Hint
              </p>
              <MarkdownText>{exam.hint}</MarkdownText>
            </div>
          )}
          {examResult[sourceIndex] && <SolutionPanel content={exam.solution} />}
        </div>
      )}
    </article>
  );
};
