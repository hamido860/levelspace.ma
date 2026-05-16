import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, List, MoveRight } from 'lucide-react';
import { LessonBlock } from './LessonBlock';
import { LessonOutline } from './LessonOutline';
import { LessonToolsMenu } from './LessonToolsMenu';
import type { DisplayedLessonBlock, LessonDomainStat } from './useDisplayedLessonBlocks';

type LessonReaderProps = {
  title: string;
  subtitle?: string;
  grade?: string;
  subject?: string;
  draftWarning?: boolean;
  displayedBlocks: DisplayedLessonBlock[];
  allBlocks: DisplayedLessonBlock[];
  domainStats: LessonDomainStat[];
  activeDomain: string;
  showDomainFilters: boolean;
  readingBlockIndex: number | null;
  quizAnswered: Record<number, boolean>;
  quizCorrect: Record<number, boolean>;
  quizSelectedOption: Record<number, string>;
  exerciseResult: Record<number, 'correct' | 'wrong' | 'shown' | null>;
  exerciseHintShown: Record<number, boolean>;
  examResult: Record<number, 'correct' | 'wrong' | 'shown' | null>;
  examHintShown: Record<number, boolean>;
  onBack: () => void;
  onDomainChange: (domainCode: string) => void;
  onAddNote: () => void;
  onReadBlock: (sourceIndex: number, text: string) => void;
  onOpenWorkspace?: () => void;
  onAdminEdit?: (sourceIndex: number, block: any) => void;
  onQuizAnswer: (sourceIndex: number, option: string, correctAnswer: string) => void;
  onExerciseSubmit: (sourceIndex: number, solution: string) => void;
  onShowExerciseHint: (sourceIndex: number) => void;
  onExamSubmit: (sourceIndex: number, solution: string) => void;
  onShowExamHint: (sourceIndex: number) => void;
  blockRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
};

const getBlockReadText = (item: DisplayedLessonBlock) =>
  [
    item.title,
    item.block?.content,
    item.block?.question,
    item.block?.quiz?.question,
    item.block?.exercise?.question,
    item.block?.exercise?.prompt,
    item.block?.exam?.question,
    ...(Array.isArray(item.block?.points) ? item.block.points : []),
    ...(Array.isArray(item.block?.rules) ? item.block.rules : []),
  ].filter(Boolean).join('\n');

export const LessonReader: React.FC<LessonReaderProps> = ({
  title,
  subtitle,
  grade,
  subject,
  draftWarning,
  displayedBlocks,
  allBlocks,
  domainStats,
  activeDomain,
  showDomainFilters,
  readingBlockIndex,
  quizAnswered,
  quizCorrect,
  quizSelectedOption,
  exerciseResult,
  exerciseHintShown,
  examResult,
  examHintShown,
  onBack,
  onDomainChange,
  onAddNote,
  onReadBlock,
  onOpenWorkspace,
  onAdminEdit,
  onQuizAnswer,
  onExerciseSubmit,
  onShowExerciseHint,
  onExamSubmit,
  onShowExamHint,
  blockRefs,
}) => {
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [viewedBlockIds, setViewedBlockIds] = useState<Set<string>>(new Set());
  const [activeBlockId, setActiveBlockId] = useState<string | null>(displayedBlocks[0]?.id || null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    setActiveBlockId(displayedBlocks[0]?.id || null);
  }, [displayedBlocks]);

  useEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (visible?.target?.id) {
          const id = visible.target.id;
          setActiveBlockId(id);
          setViewedBlockIds((previous) => {
            if (previous.has(id)) return previous;
            const next = new Set(previous);
            next.add(id);
            return next;
          });
        }
      },
      { rootMargin: '-18% 0px -55% 0px', threshold: [0.15, 0.35, 0.55] },
    );

    for (const item of displayedBlocks) {
      const node = blockRefs.current[item.id];
      if (node) observerRef.current.observe(node);
    }

    return () => observerRef.current?.disconnect();
  }, [blockRefs, displayedBlocks]);

  const practiceBlocks = useMemo(
    () => displayedBlocks.filter((item) => item.purpose === 'practice' || item.purpose === 'exam'),
    [displayedBlocks],
  );
  const practiceDone = practiceBlocks.filter((item) => exerciseResult[item.sourceIndex] || examResult[item.sourceIndex]).length;
  const answeredQuizzes = displayedBlocks.filter((item) => item.purpose === 'quiz' && quizAnswered[item.sourceIndex]).length;
  const quizCount = displayedBlocks.filter((item) => item.purpose === 'quiz').length;
  const viewedCount = displayedBlocks.filter((item) => viewedBlockIds.has(item.id)).length;

  const scrollToBlock = (blockId: string) => {
    blockRefs.current[blockId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const continueToNext = () => {
    if (displayedBlocks.length === 0) return;
    const currentIndex = displayedBlocks.findIndex((item) => item.id === activeBlockId);
    const next = displayedBlocks[Math.min(currentIndex + 1, displayedBlocks.length - 1)] || displayedBlocks[0];
    scrollToBlock(next.id);
  };

  const currentBlock = displayedBlocks.find((item) => item.id === activeBlockId) || displayedBlocks[0];

  return (
    <div className="lesson-reader-shell">
      <div className="lesson-reader-topbar">
        <button type="button" onClick={onBack} className="lesson-reader-back">
          <ArrowLeft size={16} />
          Back to dashboard
        </button>
        <div className="lesson-reader-topbar__actions">
          <button type="button" className="lesson-reader-outline-button" onClick={() => setOutlineOpen(true)}>
            <List size={16} />
            Outline
          </button>
          <LessonToolsMenu
            canAdminEdit={Boolean(onAdminEdit)}
            canOpenWorkspace={Boolean(onOpenWorkspace)}
            onAddNote={onAddNote}
            onReadCurrent={() => currentBlock && onReadBlock(currentBlock.sourceIndex, getBlockReadText(currentBlock))}
            onOpenWorkspace={onOpenWorkspace}
            onAdminEdit={() => currentBlock && onAdminEdit?.(currentBlock.sourceIndex, currentBlock.block)}
          />
        </div>
      </div>

      <header className="lesson-reader-hero">
        <div className="lesson-reader-hero__meta">
          {grade && <span>{grade}</span>}
          {subject && <span>{subject}</span>}
        </div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {draftWarning && (
          <div className="lesson-reader-warning">
            Needs teacher validation. Use this draft lesson with care.
          </div>
        )}
      </header>

      <section className="lesson-reader-progress" aria-label="Lesson progress">
        <div>
          <span>Viewed {viewedCount}/{displayedBlocks.length}</span>
          <span>Practice {practiceDone}/{practiceBlocks.length}</span>
          {quizCount > 0 && <span>Quick checks {answeredQuizzes}/{quizCount}</span>}
        </div>
        <button type="button" onClick={continueToNext} className="lesson-reader-continue">
          Continue <MoveRight size={16} />
        </button>
      </section>

      {showDomainFilters && allBlocks.length > 0 && (
        <section className="lesson-reader-domains" aria-label="Study domains">
          <button
            type="button"
            onClick={() => onDomainChange('all')}
            className={activeDomain === 'all' ? 'lesson-reader-domain lesson-reader-domain--active' : 'lesson-reader-domain'}
          >
            All <span>{allBlocks.length}</span>
          </button>
          {domainStats.map((domain) => (
            <button
              key={domain.code}
              type="button"
              onClick={() => onDomainChange(domain.code)}
              className={activeDomain === domain.code ? 'lesson-reader-domain lesson-reader-domain--active' : 'lesson-reader-domain'}
            >
              {domain.name} <span>{domain.count}</span>
            </button>
          ))}
        </section>
      )}

      <div className="lesson-reader-layout">
        <main className="lesson-reader-main" aria-label="Lesson content">
          {displayedBlocks.length > 0 ? (
            displayedBlocks.map((item) => (
              <div
                key={item.id}
                ref={(node) => {
                  blockRefs.current[item.id] = node;
                }}
              >
                <LessonBlock
                  item={item}
                  isViewed={viewedBlockIds.has(item.id)}
                  reading={readingBlockIndex === item.sourceIndex}
                  quizAnswered={quizAnswered}
                  quizCorrect={quizCorrect}
                  quizSelectedOption={quizSelectedOption}
                  exerciseResult={exerciseResult}
                  exerciseHintShown={exerciseHintShown}
                  examResult={examResult}
                  examHintShown={examHintShown}
                  onQuizAnswer={onQuizAnswer}
                  onExerciseSubmit={onExerciseSubmit}
                  onShowExerciseHint={onShowExerciseHint}
                  onExamSubmit={onExamSubmit}
                  onShowExamHint={onShowExamHint}
                />
              </div>
            ))
          ) : (
            <div className="lesson-reader-empty">
              <BookOpen size={32} />
              <h2>No sections in this view</h2>
              <p>Switch back to All or another domain to keep reading.</p>
            </div>
          )}
        </main>

        <LessonOutline
          blocks={displayedBlocks}
          activeBlockId={activeBlockId}
          viewedBlockIds={viewedBlockIds}
          onSelectBlock={scrollToBlock}
        />
      </div>

      <LessonOutline
        blocks={displayedBlocks}
        activeBlockId={activeBlockId}
        viewedBlockIds={viewedBlockIds}
        isOpen={outlineOpen}
        onClose={() => setOutlineOpen(false)}
        onSelectBlock={scrollToBlock}
      />
    </div>
  );
};

