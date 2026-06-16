import React from 'react';
import { CheckCircle2, Dumbbell, FileText, FlaskConical, HelpCircle, Lightbulb, ListChecks, PenTool, Target, XCircle } from 'lucide-react';
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

const cleanDisplayTitle = (value: string) =>
  value
    .replace(/\.(pdf|docx?|pptx?)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeTitle = (value: string) =>
  cleanDisplayTitle(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, ' ')
    .toLowerCase()
    .trim();

const isFileNameTitle = (value: string) => /\.(pdf|docx?|pptx?)$/i.test(value.trim());

const getFirstMarkdownHeading = (markdown: string) => {
  const headingLine = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^#{1,3}\s+/.test(line));

  return headingLine ? cleanDisplayTitle(headingLine.replace(/^#{1,3}\s+/, '')) : '';
};

const stripDuplicateLeadingHeadings = (markdown: string, title: string) => {
  const titleKey = normalizeTitle(title);
  const lines = markdown.split(/\r?\n/);

  while (lines.length > 0) {
    const firstMeaningfulIndex = lines.findIndex((line) => line.trim());
    if (firstMeaningfulIndex === -1) return '';
    const headingMatch = lines[firstMeaningfulIndex].trim().match(/^#{1,3}\s+(.+)$/);
    if (!headingMatch) break;

    const headingText = headingMatch[1].trim();
    const headingKey = normalizeTitle(headingText);
    if (headingKey === titleKey || isFileNameTitle(headingText)) {
      lines.splice(0, firstMeaningfulIndex + 1);
      continue;
    }
    break;
  }

  return lines.join('\n').trim();
};

const lessonLabelPattern = String.raw`(?:Ex(?:emple)?|Remarque|Attention|Important|R[eè]gle|Regle|D[eé]finition|Definition|M[eé]thode|Methode|Astuce|A retenir|À retenir|R[eé]ponse|Reponse|Solution|Correction|Conclusion|Pourquoi)`;

const normalizeLessonMarkdown = (value: string, titleContext: string) => {
  const normalized = value
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '  ')
    .replace(new RegExp(`\\b(${lessonLabelPattern})\\s*[-\u2013\u2014]\\s+`, 'gi'), '$1: ')
    .replace(/^\s*[\u2022\u25cf\u25aa\u25e6]\s+/gm, '- ')
    .replace(/^(\s*)[-\u2013\u2014]\s+/gm, '$1- ')
    .replace(/([^\n])\s+(\d+[.)]\s+)/g, '$1\n$2')
    .replace(/^(\s*)(\d+)[.)]\s+/gm, '$1$2. ')
    .replace(/([^\n])\s+([A-H][.)]\s+)/g, '$1\n$2')
    .replace(/^(\s*)([A-H])[.)]\s+/gm, '$1- **$2.** ')
    .replace(new RegExp(`([.!?)]?)\\s+(?=(${lessonLabelPattern})\\s*:)`, 'gi'), '$1\n')
    .replace(new RegExp(`(^|\\n)((${lessonLabelPattern})\\s*:)`, 'gi'), '$1**$2** ')
    .replace(/;\s+(?=[A-ZÀ-Ýa-zà-ÿ][^;:\n]{1,42}:)/g, '\n- ')
    .replace(/,\s+(?=[^\n,.;:]+(?:->|→))/g, '\n- ')
    .replace(/(^|\n)([^\n,.;:]+(?:->|→)[^\n]+)/g, '$1- $2')
    .replace(/([.!?)]?)\s+(?=(Avec\s+(?:AVOIR|ETRE|ÊTRE)|Sans\s+accord)\s*:)/gi, '$1\n')
    .replace(/(^|\n)((?:Avec\s+(?:AVOIR|ETRE|ÊTRE)|Sans\s+accord)\s*:[^\n]+)/gi, '$1- **$2**')
    .replace(/^\s*[•●▪◦]\s+/gm, '- ')
    .replace(/^(\s*)[-–—]\s+/gm, '$1- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return stripDuplicateLeadingHeadings(normalized, titleContext);
};

const MarkdownText: React.FC<{ children?: string; titleContext?: string }> = ({ children, titleContext = '' }) => (
  <div className="lesson-reader-markdown">
    <Markdown {...markdownPlugins}>{normalizeLessonMarkdown(children || '', titleContext)}</Markdown>
  </div>
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
}) => {
  const block = item.block || {};
  const sourceIndex = item.sourceIndex;
  const Icon = PURPOSE_ICONS[item.purpose];
  const contentText = getContentText(block);
  const displayTitle = cleanDisplayTitle(item.title);
  const shouldShowTitle = Boolean(displayTitle) && !isFileNameTitle(item.title);
  const contentHeading = getFirstMarkdownHeading(contentText);
  const isGenericExplanationLabel = item.label.toLowerCase() === 'explanation';
  const headingLabel = shouldShowTitle ? displayTitle : contentHeading || (isGenericExplanationLabel ? '' : item.label);
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
          {headingLabel && <p className="lesson-reader-eyebrow">{headingLabel}</p>}
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

      {contentText && !quiz && !exercise && !exam && <MarkdownText titleContext={headingLabel || item.title}>{contentText}</MarkdownText>}

      {Array.isArray(block.points) && block.points.length > 0 && (
        <ul className="lesson-reader-list">
          {block.points.map((point: string, index: number) => (
            <li key={index}><MarkdownText>{point}</MarkdownText></li>
          ))}
        </ul>
      )}

      {Array.isArray(block.rules) && block.rules.length > 0 && (
        <ul className="lesson-reader-list">
          {block.rules.map((rule: string, index: number) => (
            <li key={index}><MarkdownText>{rule}</MarkdownText></li>
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
                className={`lesson-feedback ${quizCorrect[sourceIndex] ? 'lesson-feedback--good' : 'lesson-feedback--review'}`}
              >
                <strong>{quizCorrect[sourceIndex] ? 'Correct.' : 'Review this idea.'}</strong>
                {quiz.explanation && <MarkdownText>{quiz.explanation}</MarkdownText>}
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
