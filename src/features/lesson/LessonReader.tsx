import React, { useEffect, useMemo, useState } from 'react';
import { 
  ArrowLeft, 
  BookOpen, 
  Target, 
  MessageSquare, 
  Sparkles, 
  Lightbulb, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight, 
  FileText,
  HelpCircle,
  Dumbbell,
  PenTool,
  ListChecks
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LessonBlock } from './LessonBlock';
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

const getLessonIllustration = (title: string | null | undefined, subject?: string | null | undefined) => {
  const t = String(title || '').toLowerCase();
  const s = String(subject || '').toLowerCase();
  
  if (
    t.includes('math') || 
    t.includes('geom') || 
    t.includes('arith') || 
    t.includes('calcul') || 
    t.includes('algebra') || 
    t.includes('suite') || 
    t.includes('série') || 
    t.includes('analyse') || 
    s.includes('math')
  ) {
    return '/illustrations/math_geometry.png';
  }
  if (
    t.includes('physic') || 
    t.includes('physiq') || 
    t.includes('chem') || 
    t.includes('chim') || 
    t.includes('electr') || 
    t.includes('circuit') || 
    t.includes('combust') || 
    s.includes('phys') || 
    s.includes('chim')
  ) {
    return '/illustrations/physics_chemistry.png';
  }
  if (
    t.includes('svt') || 
    t.includes('earth') || 
    t.includes('life') || 
    t.includes('tecton') || 
    t.includes('plaqu') || 
    t.includes('séisme') || 
    t.includes('volcan') || 
    t.includes('roche') || 
    t.includes('géolog') || 
    t.includes('biolog') || 
    s.includes('svt') || 
    s.includes('vie')
  ) {
    return '/illustrations/earth_sciences.png';
  }
  if (
    t.includes('lang') || 
    t.includes('arab') || 
    t.includes('french') || 
    t.includes('franç') || 
    t.includes('read') || 
    t.includes('book') || 
    t.includes('littér') || 
    t.includes('philoso') || 
    t.includes('lexiq') || 
    t.includes('gramm') || 
    t.includes('ortho') || 
    t.includes('conju') || 
    s.includes('lang') || 
    s.includes('fr') || 
    s.includes('ar') || 
    s.includes('phil')
  ) {
    return '/illustrations/humanities_languages.png';
  }
  return '/illustrations/default_edu.png';
};

const PURPOSE_ICONS: Record<string, { icon: React.ElementType; bg: string; text: string }> = {
  objective: { icon: Target, bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
  example: { icon: MessageSquare, bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  explanation: { icon: Sparkles, bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400' },
  key_idea: { icon: Lightbulb, bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  definition: { icon: FileText, bg: 'bg-teal-50 dark:bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400' },
  quiz: { icon: HelpCircle, bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
  practice: { icon: Dumbbell, bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  exam: { icon: PenTool, bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400' },
  summary: { icon: ListChecks, bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
};

const getPurposeLabel = (purpose: string, label: string) => {
  const l = label.toLowerCase();
  if (l.includes('objective') || l.includes('objectif')) return 'Objectif';
  if (l.includes('example') || l.includes('exemple')) return 'Exemple';
  if (l.includes('explanation') || l.includes('explication')) return 'Explication';
  if (l.includes('key') || l.includes('idée') || l.includes('idee')) return 'Idée Clé';
  if (l.includes('summary') || l.includes('conclusion') || l.includes('checkpoint')) return 'Conclusion';
  
  switch (purpose) {
    case 'objective': return 'Objectif';
    case 'example': return 'Exemple';
    case 'explanation': return 'Explication';
    case 'key_idea': return 'Idée Clé';
    case 'summary':
    case 'checkpoint':
    case 'practice':
    case 'exam':
      return 'Conclusion';
    default: return label;
  }
};

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
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(displayedBlocks[0]?.id || null);
  const [viewedBlockIds, setViewedBlockIds] = useState<Set<string>>(new Set());
  const [activeBlockId, setActiveBlockId] = useState<string | null>(displayedBlocks[0]?.id || null);

  useEffect(() => {
    if (displayedBlocks.length > 0) {
      const firstId = displayedBlocks[0].id;
      setExpandedBlockId(firstId);
      setActiveBlockId(firstId);
      setViewedBlockIds(new Set([firstId]));
    }
  }, [displayedBlocks]);

  const viewedCount = displayedBlocks.filter((item) => viewedBlockIds.has(item.id)).length;
  const totalBlocks = displayedBlocks.length;
  const progressPercent = totalBlocks > 0 ? Math.round((viewedCount / totalBlocks) * 100) : 0;

  const currentBlock = displayedBlocks.find((item) => item.id === expandedBlockId) || displayedBlocks[0];

  const handleContinue = () => {
    if (displayedBlocks.length === 0) return;
    const currentIndex = displayedBlocks.findIndex((item) => item.id === expandedBlockId);
    if (currentIndex !== -1 && currentIndex < displayedBlocks.length - 1) {
      const nextBlock = displayedBlocks[currentIndex + 1];
      setExpandedBlockId(nextBlock.id);
      setActiveBlockId(nextBlock.id);
      setViewedBlockIds((prev) => {
        if (prev.has(nextBlock.id)) return prev;
        const next = new Set(prev);
        next.add(nextBlock.id);
        return next;
      });
    } else {
      // Completed, redirect back
      onBack();
    }
  };

  return (
    <div className="lesson-reader-shell min-h-screen bg-slate-50/50 dark:bg-background pb-20 select-none">
      
      {/* Topbar navigation with back controls */}
      <div className="lesson-reader-topbar bg-white dark:bg-paper border-b border-slate-200 dark:border-white/8">
        <button 
          type="button" 
          onClick={onBack} 
          className="lesson-reader-back flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-950 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to dashboard
        </button>
        <div className="lesson-reader-topbar__actions">
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

      {/* Main Single-Column Player Card */}
      <main className="max-w-xl mx-auto mt-8 px-4 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Redesigned Card Container */}
        <div className="w-full bg-white dark:bg-paper rounded-[2rem] shadow-lg border border-slate-200 dark:border-white/8 overflow-hidden flex flex-col">
          
          {/* Top Full-bleed Image Banner */}
          <div className="h-44 w-full relative bg-slate-100 dark:bg-surface-low shrink-0 overflow-hidden border-b border-slate-100 dark:border-white/5">
            <img 
              src={getLessonIllustration(title, subject)}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-[1.02]"
            />
            {/* Tint Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-black/35 flex items-center justify-center px-4" />
            
            {/* Center Lesson Title */}
            <h2 className="absolute inset-0 flex items-center justify-center text-center font-display font-black text-xl tracking-wide text-white drop-shadow-md uppercase px-8 select-none">
              {title}
            </h2>
          </div>

          {/* Progress Indicator Section */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 dark:bg-surface-low dark:border-white/5 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-slate-500 dark:text-ink-muted">
              Progress: {viewedCount} / {totalBlocks}
            </span>
            <div className="flex-1 max-w-[200px] ml-4 bg-slate-200 dark:bg-surface-mid h-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Draft warning banner if applicable */}
          {draftWarning && (
            <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 text-amber-800 text-[11px] font-bold text-center">
              Needs teacher validation. Use this draft lesson with care.
            </div>
          )}

          {/* Domain filtering if applicable */}
          {showDomainFilters && allBlocks.length > 0 && (
            <div className="px-6 py-3 bg-white border-b border-slate-100 dark:bg-paper dark:border-white/5 flex gap-2 overflow-x-auto select-none shrink-0 no-scrollbar">
              <button
                type="button"
                onClick={() => onDomainChange('all')}
                className={`shrink-0 rounded-full px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                  activeDomain === 'all' 
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' 
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-surface-low dark:text-ink-muted'
                }`}
              >
                All {allBlocks.length}
              </button>
              {domainStats.map((domain) => (
                <button
                  key={domain.code}
                  type="button"
                  onClick={() => onDomainChange(domain.code)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                    activeDomain === domain.code 
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' 
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-surface-low dark:text-ink-muted'
                  }`}
                >
                  {domain.name} {domain.count}
                </button>
              ))}
            </div>
          )}

          {/* Accordion Blocks Scrollable List */}
          <div className="flex-grow overflow-y-auto px-6 py-4 space-y-2 no-scrollbar min-h-[400px]">
            {displayedBlocks.map((item, index) => {
              const isExpanded = expandedBlockId === item.id;
              const isViewed = viewedBlockIds.has(item.id);
              const purposeStyle = PURPOSE_ICONS[item.purpose] || PURPOSE_ICONS.explanation;
              const BlockIcon = purposeStyle.icon;
              
              return (
                <div 
                  key={item.id}
                  className={`border border-slate-100 rounded-2xl dark:border-white/5 overflow-hidden transition-all ${
                    isExpanded 
                      ? 'bg-slate-50/20 border-[#007A87]/20 shadow-sm dark:bg-white/1' 
                      : 'hover:bg-slate-50/50 dark:hover:bg-white/3'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedBlockId(isExpanded ? null : item.id);
                      setActiveBlockId(item.id);
                      setViewedBlockIds((prev) => {
                        if (prev.has(item.id)) return prev;
                        const next = new Set(prev);
                        next.add(item.id);
                        return next;
                      });
                    }}
                    className="w-full py-4 px-4 flex items-center justify-between gap-4 text-left transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Round colorful icon */}
                      <div className={`w-8 h-8 rounded-full ${purposeStyle.bg} flex items-center justify-center shrink-0 ${purposeStyle.text}`}>
                        <BlockIcon size={15} />
                      </div>
                      <div className="min-w-0">
                        <h4 className={`text-sm font-bold leading-snug truncate ${isExpanded ? 'text-[#007A87] dark:text-accent' : 'text-slate-800 dark:text-ink'}`}>
                          {getPurposeLabel(item.purpose, item.title)}
                        </h4>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {isViewed && (
                        <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full dark:bg-emerald-500/10 dark:text-emerald-400">
                          ✓ viewed
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-400" />
                      )}
                    </div>
                  </button>
                  
                  {/* Expanded Block Body */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-5 pt-1 text-slate-700 leading-relaxed border-t border-slate-50 dark:border-white/5 animate-in slide-in-from-top-2 duration-300">
                          <LessonBlock
                            item={item}
                            isViewed={isViewed}
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
                          
                          {/* Available status dot for conclusion / last block */}
                          {index === displayedBlocks.length - 1 && (
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
                              <span className="text-[10px] text-slate-400 dark:text-ink-muted italic">Résumé de la leçon</span>
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#1B8354] dark:text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Available
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {displayedBlocks.length === 0 && (
              <div className="text-center py-12 text-slate-400 dark:text-ink-muted">
                No sections found in this lesson view.
              </div>
            )}
          </div>

          {/* Card Footer Controls */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 dark:bg-surface-low dark:border-white/5 flex items-center justify-center shrink-0">
            <button 
              onClick={handleContinue}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-8 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10 hover:shadow-lg transition-all"
            >
              Continue <ChevronRight size={14} className="stroke-[3]" />
            </button>
          </div>

        </div>
      </main>
    </div>
  );
};
