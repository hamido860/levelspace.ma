import React from 'react';
import { CheckCircle2, Dumbbell, FileText, FlaskConical, HelpCircle, Lightbulb, ListChecks, PenTool, Target, XCircle, Volume2, Bot, ChevronDown, ChevronUp, Sparkles, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import type { DisplayedLessonBlock, PedagogicalPurpose } from './useDisplayedLessonBlocks';

const extractText = (node: any): string => {
  if (node.type === 'text') return node.value || '';
  if (node.children) return node.children.map(extractText).join('');
  return '';
};

const markdownPlugins = {
  remarkPlugins: [remarkMath, remarkGfm],
  rehypePlugins: [[rehypeKatex, { strict: false }]] as any,
  components: {
    blockquote: ({ node, children, ...props }: any) => {
      const textContent = extractText(node).toLowerCase();
      
      let isExample = false;
      let isQuiz = false;
      let isNote = false;
      
      if (textContent.includes('example') || textContent.includes('exemple') || textContent.includes('مثال')) {
        isExample = true;
      } else if (textContent.includes('quiz') || textContent.includes('question') || textContent.includes('سؤال')) {
        isQuiz = true;
      } else if (textContent.includes('note') || textContent.includes('ملاحظة') || textContent.includes('remarque') || textContent.includes('important')) {
        isNote = true;
      }

      let bgClass = "bg-slate-100 border-slate-200 dark:bg-surface-low dark:border-white/5";
      let icon = null;
      let titleClass = "text-slate-800 dark:text-ink";
      let label = "";

      if (isExample) {
        bgClass = "bg-amber-500/10 border-amber-500/20";
        icon = <Sparkles className="text-amber-500" size={16} />;
        titleClass = "text-amber-700 dark:text-amber-400";
        label = "Example";
      } else if (isQuiz) {
        bgClass = "bg-purple-500/10 border-purple-500/20";
        icon = <HelpCircle className="text-purple-500" size={16} />;
        titleClass = "text-purple-700 dark:text-purple-400";
        label = "Quiz";
      } else if (isNote) {
        bgClass = "bg-blue-500/10 border-blue-500/20";
        icon = <Info className="text-blue-500" size={16} />;
        titleClass = "text-blue-700 dark:text-blue-400";
        label = "Note";
      } else {
        return (
          <blockquote className="border-l-4 border-accent/50 pl-4 py-1.5 my-4 text-slate-600 dark:text-ink-secondary italic bg-slate-50 dark:bg-surface-low/50 rounded-r-lg" {...props}>
            {children}
          </blockquote>
        );
      }

      return (
        <div className={`my-5 p-5 md:p-6 rounded-2xl border ${bgClass} shadow-sm`}>
          {icon && (
            <div className={`flex items-center gap-2 font-bold mb-3 ${titleClass}`}>
              {icon}
              <span className="uppercase text-[11px] tracking-wider font-display">
                {label}
              </span>
            </div>
          )}
          <div className="text-sm leading-relaxed text-slate-700 dark:text-ink-secondary prose prose-sm max-w-none">
            {children}
          </div>
        </div>
      );
    },
    table: ({ node, children, ...props }: any) => (
      <div className="overflow-x-auto my-5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm bg-white dark:bg-paper">
        <table className="w-full text-left border-collapse text-sm" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ node, children, ...props }: any) => (
      <th className="bg-slate-50 dark:bg-surface-low border-b border-slate-200 dark:border-white/10 p-4 font-bold text-slate-900 dark:text-ink" {...props}>
        {children}
      </th>
    ),
    td: ({ node, children, ...props }: any) => (
      <td className="p-4 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-ink-secondary last:border-b-0" {...props}>
        {children}
      </td>
    ),
    code: ({ node, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const isBlock = match || String(children).includes('\n');
      
      if (isBlock) {
        return (
          <div className="my-5 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden bg-slate-900 shadow-sm">
            <div className="flex items-center px-4 py-2 bg-slate-800 border-b border-slate-700">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">{match ? match[1] : 'Code'}</span>
            </div>
            <div className="p-4 overflow-x-auto">
              <code className={`${className || ''} block text-sm font-mono text-slate-50`} {...props}>
                {children}
              </code>
            </div>
          </div>
        );
      }
      return (
        <code className="px-1.5 py-0.5 mx-0.5 rounded-md bg-surface-low text-ink font-semibold text-[0.9em] not-italic inline-code-badge" style={{ fontFamily: 'inherit' }} {...props}>
          {children}
        </code>
      );
    }
  }
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
  const [isOpen, setIsOpen] = React.useState(item.sourceIndex === 0); // First block open by default
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
          {/* Accordion Toggle Button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
            className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
              isOpen 
                ? 'bg-accent border-accent text-white hover:bg-accent/90' 
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:bg-surface-low dark:border-white/5 dark:text-ink-muted dark:hover:text-ink hover:scale-105'
            }`}
            title={isOpen ? "Collapse" : "Expand"}
          >
            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        <span className={`lesson-reader-block__status ${isViewed ? 'lesson-reader-block__status--viewed' : ''}`}>
          {isViewed ? 'Viewed' : 'New'}
        </span>
      </header>

      {isOpen && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          {reading && (
            <div className="lesson-reader-read-state">
              <span /> Reading this section aloud
            </div>
          )}

      {contentText && !quiz && !exercise && !exam && <MarkdownText>{contentText}</MarkdownText>}

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
            <div key={index} className="lesson-reader-example">
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
      </div>
      )}
    </article>
  );
};
