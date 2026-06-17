import React from 'react';
import { CheckCircle2, Dumbbell, FileText, FlaskConical, HelpCircle, Lightbulb, ListChecks, PenTool, Target, XCircle, Volume2, Bot } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Markdown from 'react-markdown';
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
  onSpeak?: () => void;
  onAskAI?: () => void;
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
  <div className="lesson-reader-markdown">
    <Markdown {...markdownPlugins}>{children || ''}</Markdown>
  </div>
);

const InlineMarkdownText: React.FC<{ children?: string }> = ({ children }) => (
  <span className="lesson-reader-markdown inline-block">
    <Markdown 
      {...markdownPlugins} 
      components={{
        p: ({ node, ...props }) => <span {...props} />
      }}
    >
      {children || ''}
    </Markdown>
  </span>
);

const SolutionPanel: React.FC<{ title?: string; content?: string }> = ({ title = 'Solution', content }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="lesson-answer-panel"
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
  onSpeak,
  onAskAI,
}) => {
  const block = item.block || {};
  const sourceIndex = item.sourceIndex;
  const Icon = PURPOSE_ICONS[item.purpose];
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
    <article id={item.id} className="lesson-reader-block scroll-mt-28">
      <header className="lesson-reader-block__header">
        <div className="lesson-reader-block__icon">
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="lesson-reader-eyebrow">{item.label}</p>
          <h2 className="lesson-reader-block__title">{item.title}</h2>
        </div>
        <div className="flex items-center gap-1.5 mr-2 shrink-0">
          {onSpeak && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSpeak(); }}
              className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                reading 
                  ? 'bg-accent/20 border-accent text-accent animate-pulse' 
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:bg-surface-low dark:border-white/5 dark:text-ink-muted dark:hover:text-ink hover:scale-105'
              }`}
              title="Read Aloud"
            >
              <Volume2 size={12} />
            </button>
          )}
          {onAskAI && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAskAI(); }}
              className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:bg-surface-low dark:border-white/5 dark:text-ink-muted dark:hover:text-ink transition-all cursor-pointer hover:scale-105"
              title="Ask AI Assistant"
            >
              <Bot size={12} />
            </button>
          )}
        </div>
        <span className={`lesson-reader-block__status ${isViewed ? 'lesson-reader-block__status--viewed' : ''}`}>
          {isViewed ? 'Viewed' : 'New'}
        </span>
      </header>

      {reading && (
        <div className="lesson-reader-read-state">
          <span /> Reading this section aloud
        </div>
      )}

      {contentText && !quiz && !exercise && !exam && (
        <div className={item.purpose === 'example' ? 'md:whitespace-nowrap overflow-x-auto no-scrollbar' : ''}>
          <MarkdownText>{contentText}</MarkdownText>
        </div>
      )}

      {Array.isArray(block.points) && block.points.length > 0 && (
        <ul className="lesson-reader-list">
          {block.points.map((point: string, index: number) => (
            <li key={index}><InlineMarkdownText>{point}</InlineMarkdownText></li>
          ))}
        </ul>
      )}

      {Array.isArray(block.rules) && block.rules.length > 0 && (
        <ul className="lesson-reader-list">
          {block.rules.map((rule: string, index: number) => (
            <li key={index}><InlineMarkdownText>{rule}</InlineMarkdownText></li>
          ))}
        </ul>
      )}

      {Array.isArray(block.examples) && block.examples.length > 0 && (
        <div className="lesson-reader-stack">
          {block.examples.map((example: any, index: number) => (
            <div key={index} className="lesson-reader-example md:whitespace-nowrap overflow-x-auto no-scrollbar">
              {example.question && <MarkdownText>{example.question}</MarkdownText>}
              {Array.isArray(example.steps) && example.steps.map((step: string, stepIndex: number) => (
                <div key={stepIndex} className="lesson-reader-example__step">
                  <MarkdownText>{step}</MarkdownText>
                </div>
              ))}
              {example.answer && <SolutionPanel title="Answer" content={example.answer} />}
            </div>
          ))}
        </div>
      )}

      {quiz && Array.isArray(quiz.options) && (
        <div className="lesson-reader-check">
          <MarkdownText>{quiz.question}</MarkdownText>
          <div className="lesson-reader-options">
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
                  className={`lesson-reader-option ${answered && correct ? 'lesson-reader-option--correct' : ''} ${answered && selected && !correct ? 'lesson-reader-option--wrong' : ''}`}
                >
                  <span><InlineMarkdownText>{option}</InlineMarkdownText></span>
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
                className={`lesson-feedback ${quizCorrect[sourceIndex] ? 'lesson-feedback--good' : 'lesson-feedback--review'}`}
              >
                <div className="flex items-start gap-3">
                  {quizCorrect[sourceIndex] ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink mb-1">
                      {quizCorrect[sourceIndex] ? 'Correct!' : 'Review this idea.'}
                    </p>
                    {quiz.explanation && <MarkdownText>{quiz.explanation}</MarkdownText>}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {exercise && (
        <div className="lesson-reader-check">
          <MarkdownText>{exercise.question || exercise.prompt}</MarkdownText>
          <div className="lesson-reader-actions">
            {exercise.hint && (
              <button type="button" onClick={() => onShowExerciseHint(sourceIndex)} className="lesson-reader-secondary">
                {exerciseHintShown[sourceIndex] ? 'Hint shown' : 'Show hint'}
              </button>
            )}
            <button type="button" onClick={() => onExerciseSubmit(sourceIndex, exercise.solution || '')} className="lesson-reader-primary">
              Show solution
            </button>
          </div>
          {exerciseHintShown[sourceIndex] && exercise.hint && (
            <div className="lesson-hint"><MarkdownText>{exercise.hint}</MarkdownText></div>
          )}
          {exerciseResult[sourceIndex] && <SolutionPanel content={exercise.solution} />}
        </div>
      )}

      {exam && (
        <div className="lesson-reader-check lesson-reader-check--exam">
          {exam.source && <p className="lesson-reader-eyebrow">{exam.source}</p>}
          <MarkdownText>{exam.question}</MarkdownText>
          <div className="lesson-reader-actions">
            {exam.hint && (
              <button type="button" onClick={() => onShowExamHint(sourceIndex)} className="lesson-reader-secondary">
                {examHintShown[sourceIndex] ? 'Hint shown' : 'Show hint'}
              </button>
            )}
            <button type="button" onClick={() => onExamSubmit(sourceIndex, exam.solution || '')} className="lesson-reader-primary">
              Show solution
            </button>
          </div>
          {examHintShown[sourceIndex] && exam.hint && (
            <div className="lesson-hint"><MarkdownText>{exam.hint}</MarkdownText></div>
          )}
          {examResult[sourceIndex] && <SolutionPanel content={exam.solution} />}
        </div>
      )}
    </article>
  );
};
