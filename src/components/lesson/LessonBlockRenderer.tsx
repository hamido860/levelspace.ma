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
  definition: { accent: 'text-blue-700', panel: 'bg-blue-50/70', border: 'border-blue-100', icon: BookOpen },
  key_idea: { accent: 'text-indigo-700', panel: 'bg-indigo-50/70', border: 'border-indigo-100', icon: Star },
  simple_explanation: { accent: 'text-slate-700', panel: 'bg-transparent', border: 'border-transparent', icon: Sparkles },
  example: { accent: 'text-yellow-700', panel: 'bg-yellow-50/70', border: 'border-yellow-100', icon: Lightbulb },
  question: { accent: 'text-purple-700', panel: 'bg-transparent', border: 'border-transparent', icon: HelpCircle },
  warning: { accent: 'text-orange-700', panel: 'bg-orange-50/80', border: 'border-orange-100', icon: AlertTriangle },
  dont_confuse: { accent: 'text-red-700', panel: 'bg-red-50/70', border: 'border-red-100', icon: Ban },
  note: { accent: 'text-sky-700', panel: 'bg-transparent', border: 'border-transparent', icon: NotebookText },
  formula: { accent: 'text-cyan-700', panel: 'bg-transparent', border: 'border-transparent', icon: Sigma },
  remember: { accent: 'text-green-700', panel: 'bg-green-50/70', border: 'border-green-100', icon: CheckCircle2 },
  practice: { accent: 'text-teal-700', panel: 'bg-transparent', border: 'border-transparent', icon: FlaskConical },
  ai_hint: { accent: 'text-violet-700', panel: 'bg-transparent', border: 'border-transparent', icon: Brain },
  vocabulary: { accent: 'text-pink-700', panel: 'bg-transparent', border: 'border-transparent', icon: Type },
  summary: { accent: 'text-emerald-700', panel: 'bg-transparent', border: 'border-transparent', icon: ListChecks },
  checkpoint: { accent: 'text-green-700', panel: 'bg-green-50/80', border: 'border-green-100', icon: Target },
};

const TYPE_LABELS: Record<LearningBlockType, string> = {
  definition: 'Definition',
  key_idea: 'Key idea',
  simple_explanation: 'Simple explanation',
  example: 'Example',
  question: 'Question',
  warning: 'Warning',
  dont_confuse: "Don't confuse",
  note: 'Note',
  formula: 'Formula',
  remember: 'Remember',
  practice: 'Practice',
  ai_hint: 'AI hint',
  vocabulary: 'Vocabulary',
  summary: 'Summary',
  checkpoint: 'Quick check',
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
  const hasPanel = style.panel !== 'bg-transparent';

  return (
    <section className={`${hasPanel ? `rounded-xl border ${style.border} ${style.panel}` : 'border-b border-ink/10'} p-4`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 text-xl leading-none">
          {getBlockEmoji(block)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Icon size={15} className={style.accent} />
            <span className={`text-[11px] font-bold uppercase tracking-normal ${style.accent}`}>
              {getBlockEmoji(block)} {TYPE_LABELS[block.type]}
            </span>
          </div>
          <h3 className="mb-1 text-base font-bold leading-snug text-ink">{block.title}</h3>
          <div className="lesson-copy text-sm leading-7 text-ink">
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
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
          {terms.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => onVocabularyTermClick?.(term, block)}
              className="text-[12px] font-semibold text-pink-700 underline decoration-pink-300 underline-offset-4 transition-colors hover:text-pink-900"
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
