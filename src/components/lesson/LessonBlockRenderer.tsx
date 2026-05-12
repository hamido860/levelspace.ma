import React from 'react';
import {
  AlertTriangle,
  Ban,
  BookOpen,
  Brain,
  CheckCircle2,
  FlaskConical,
  HelpCircle,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  NotebookText,
  Sigma,
  Sparkles,
  Star,
  Target,
  Type,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  LEARNING_BLOCK_EMOJIS,
  LearningBlockType,
  StructuredLearningBlock,
} from '../../services/geminiService';

type LessonBlockComponentProps = {
  block: StructuredLearningBlock;
  lazyMode?: boolean;
  onVocabularyTermClick?: (term: string, sourceBlock: StructuredLearningBlock) => void;
};

type LessonBlockRendererProps = {
  blocks: StructuredLearningBlock[];
  lazyMode?: boolean;
  onVocabularyTermClick?: (term: string, sourceBlock: StructuredLearningBlock) => void;
};

const BLOCK_STYLES: Record<LearningBlockType, {
  accent: string;
  panel: string;
  border: string;
  icon: React.ElementType;
}> = {
  definition: { accent: 'text-blue-700', panel: 'bg-blue-50/80', border: 'border-blue-200', icon: BookOpen },
  key_idea: { accent: 'text-indigo-700', panel: 'bg-indigo-50/80', border: 'border-indigo-200', icon: Star },
  simple_explanation: { accent: 'text-slate-700', panel: 'bg-slate-50/90', border: 'border-slate-200', icon: Sparkles },
  example: { accent: 'text-yellow-700', panel: 'bg-yellow-50/90', border: 'border-yellow-200', icon: Lightbulb },
  question: { accent: 'text-purple-700', panel: 'bg-purple-50/80', border: 'border-purple-200', icon: HelpCircle },
  warning: { accent: 'text-orange-700', panel: 'bg-orange-50/90', border: 'border-orange-200', icon: AlertTriangle },
  dont_confuse: { accent: 'text-red-700', panel: 'bg-red-50/80', border: 'border-red-200', icon: Ban },
  note: { accent: 'text-sky-700', panel: 'bg-sky-50/80', border: 'border-sky-200', icon: NotebookText },
  formula: { accent: 'text-cyan-700', panel: 'bg-cyan-50/80', border: 'border-cyan-200', icon: Sigma },
  remember: { accent: 'text-green-700', panel: 'bg-green-50/80', border: 'border-green-200', icon: CheckCircle2 },
  practice: { accent: 'text-teal-700', panel: 'bg-teal-50/80', border: 'border-teal-200', icon: FlaskConical },
  ai_hint: { accent: 'text-violet-700', panel: 'bg-violet-50/80', border: 'border-violet-200', icon: Brain },
  vocabulary: { accent: 'text-pink-700', panel: 'bg-pink-50/80', border: 'border-pink-200', icon: Type },
  summary: { accent: 'text-emerald-700', panel: 'bg-emerald-50/80', border: 'border-emerald-200', icon: ListChecks },
  checkpoint: { accent: 'text-green-700', panel: 'bg-green-50/90', border: 'border-green-200', icon: Target },
};

const ACTION_LABELS: Record<string, string> = {
  read: 'Read',
  think: 'Think',
  answer: 'Answer',
  remember: 'Remember',
  practice: 'Practice',
  compare: 'Compare',
};

const getBlockEmoji = (block: StructuredLearningBlock) =>
  block.emoji === LEARNING_BLOCK_EMOJIS[block.type] ? block.emoji : LEARNING_BLOCK_EMOJIS[block.type];

const markdownPlugins = {
  remarkPlugins: [remarkMath],
  rehypePlugins: [[rehypeKatex, { strict: false }]] as any,
};

const BaseLearningBlock: React.FC<LessonBlockComponentProps & { children?: React.ReactNode }> = ({
  block,
  lazyMode,
  children,
}) => {
  const style = BLOCK_STYLES[block.type];
  const Icon = style.icon;
  const content = lazyMode && block.shortVersion ? block.shortVersion : block.content;

  return (
    <section className={`rounded-2xl border ${style.border} ${style.panel} p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper text-xl shadow-sm">
          {getBlockEmoji(block)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Icon size={15} className={style.accent} />
            <h3 className={`text-sm font-bold ${style.accent}`}>{block.title}</h3>
            <span className="rounded-full bg-paper/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-muted">
              {ACTION_LABELS[block.studentAction] || block.studentAction}
            </span>
            {block.importance === 'high' && (
              <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-paper">
                Important
              </span>
            )}
            {lazyMode && block.shortVersion && (
              <span className="rounded-full bg-paper px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-ink">
                Lazy mode
              </span>
            )}
          </div>
          <div className="lesson-copy text-sm leading-relaxed text-ink">
            <Markdown {...markdownPlugins}>{content}</Markdown>
          </div>
          {children}
        </div>
      </div>
    </section>
  );
};

export const DefinitionBlock: React.FC<LessonBlockComponentProps> = (props) => <BaseLearningBlock {...props} />;
export const KeyIdeaBlock: React.FC<LessonBlockComponentProps> = (props) => <BaseLearningBlock {...props} />;
export const SimpleExplanationBlock: React.FC<LessonBlockComponentProps> = (props) => <BaseLearningBlock {...props} />;
export const ExampleBlock: React.FC<LessonBlockComponentProps> = (props) => <BaseLearningBlock {...props} />;
export const QuestionBlock: React.FC<LessonBlockComponentProps> = (props) => <BaseLearningBlock {...props} />;
export const WarningBlock: React.FC<LessonBlockComponentProps> = (props) => <BaseLearningBlock {...props} />;
export const DontConfuseBlock: React.FC<LessonBlockComponentProps> = (props) => <BaseLearningBlock {...props} />;
export const NoteBlock: React.FC<LessonBlockComponentProps> = (props) => <BaseLearningBlock {...props} />;
export const FormulaBlock: React.FC<LessonBlockComponentProps> = (props) => <BaseLearningBlock {...props} />;
export const RememberBlock: React.FC<LessonBlockComponentProps> = (props) => <BaseLearningBlock {...props} />;
export const PracticeBlock: React.FC<LessonBlockComponentProps> = (props) => <BaseLearningBlock {...props} />;
export const AIHintBlock: React.FC<LessonBlockComponentProps> = (props) => <BaseLearningBlock {...props} />;
export const SummaryBlock: React.FC<LessonBlockComponentProps> = (props) => <BaseLearningBlock {...props} />;
export const CheckpointBlock: React.FC<LessonBlockComponentProps> = (props) => <BaseLearningBlock {...props} />;

const extractVocabularyTerms = (block: StructuredLearningBlock) => {
  const fromRelatedTerms = block.relatedTerms || [];
  const fromContent = block.content
    .split(/[,;،\n]/)
    .map((term) => term.replace(/^[\s\-•]+|[\s.]+$/g, '').trim());
  const seen = new Set<string>();
  return [...fromRelatedTerms, ...fromContent].filter((term) => {
    const key = term.toLowerCase();
    if (!term || term.length > 36 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const VocabularyBlock: React.FC<LessonBlockComponentProps> = ({
  block,
  lazyMode,
  onVocabularyTermClick,
}) => {
  const terms = extractVocabularyTerms(block);

  return (
    <BaseLearningBlock block={block} lazyMode={lazyMode}>
      {terms.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {terms.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => onVocabularyTermClick?.(term, block)}
              className="rounded-full border border-pink-200 bg-paper px-3 py-1.5 text-[11px] font-bold text-pink-700 transition-colors hover:border-pink-400 hover:bg-pink-50"
            >
              {term}
            </button>
          ))}
        </div>
      )}
    </BaseLearningBlock>
  );
};

const COMPONENTS: Record<LearningBlockType, React.FC<LessonBlockComponentProps>> = {
  definition: DefinitionBlock,
  key_idea: KeyIdeaBlock,
  simple_explanation: SimpleExplanationBlock,
  example: ExampleBlock,
  question: QuestionBlock,
  warning: WarningBlock,
  dont_confuse: DontConfuseBlock,
  note: NoteBlock,
  formula: FormulaBlock,
  remember: RememberBlock,
  practice: PracticeBlock,
  ai_hint: AIHintBlock,
  vocabulary: VocabularyBlock,
  summary: SummaryBlock,
  checkpoint: CheckpointBlock,
};

const LAZY_PRIORITY: LearningBlockType[] = ['remember', 'checkpoint', 'example', 'definition', 'key_idea'];

export const LessonBlockRenderer: React.FC<LessonBlockRendererProps> = ({
  blocks,
  lazyMode = false,
  onVocabularyTermClick,
}) => {
  const visibleBlocks = lazyMode
    ? [...blocks].sort((left, right) => {
        const leftPriority = LAZY_PRIORITY.indexOf(left.type);
        const rightPriority = LAZY_PRIORITY.indexOf(right.type);
        return (leftPriority === -1 ? 99 : leftPriority) - (rightPriority === -1 ? 99 : rightPriority);
      })
    : blocks;

  return (
    <div className="space-y-3">
      {visibleBlocks.map((block) => {
        const Component = COMPONENTS[block.type] || SimpleExplanationBlock;
        return (
          <Component
            key={block.id}
            block={block}
            lazyMode={lazyMode}
            onVocabularyTermClick={onVocabularyTermClick}
          />
        );
      })}
    </div>
  );
};
