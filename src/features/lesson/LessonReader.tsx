import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { 
  ArrowLeft, 
  BookOpen,
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  Volume2,
  Bot,
  Info,
  Camera,
  Award,
  AlertTriangle,
  Timer,
  RefreshCw,
  Activity,
  FileText,
  CheckSquare,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LessonBlock } from './LessonBlock';
import type { DisplayedLessonBlock, LessonDomainStat } from './useDisplayedLessonBlocks';
import { getLessonIllustration, PURPOSE_ICONS, getBlockReadText } from './lessonUtils';
import { BannerImagePicker } from '../../components/BannerImagePicker';
import { SelectionActions } from '../../components/SelectionActions';

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
  prevLesson?: any | null;
  nextLesson?: any | null;
  onNavigateToLesson?: (lessonId: string) => void;
  onTakeTest?: () => void;
  hasTests?: boolean;
  bannerImage?: string;
  onUpdateBanner?: (url: string) => void;
  startAtTest?: boolean;
  allLessonsInModule?: any[];
  timerSeconds: number;
  isTimerRunning: boolean;
  onTimerRunningChange: (running: boolean) => void;
  onTimerReset: () => void;
  isSupportModalOpen: boolean;
  onSupportModalOpenChange: (open: boolean) => void;
  activityLogs: any[];
  defaultDuration: number;
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
  prevLesson,
  nextLesson,
  onNavigateToLesson,
  onTakeTest,
  hasTests,
  bannerImage,
  onUpdateBanner,
  startAtTest,
  allLessonsInModule = [],
  timerSeconds,
  isTimerRunning,
  onTimerRunningChange,
  onTimerReset,
  isSupportModalOpen,
  onSupportModalOpenChange,
  activityLogs,
  defaultDuration,
}) => {
  const { t } = useLanguage();
  const [showImagePicker, setShowImagePicker] = useState(false);
  
  const otherLessons = useMemo(() => {
    const currentId = (allLessonsInModule || []).find((l: any) => l.title === title)?.id;
    return (allLessonsInModule || []).filter((l: any) => l.id !== currentId && l.title !== title);
  }, [allLessonsInModule, title]);

  const hasSidebar = otherLessons.length > 0;
  
  // Pinned lessons state persisting to localStorage — scoped per module
  const moduleIdForPins = useMemo(() => {
    const first = (allLessonsInModule || [])[0];
    return first?.moduleId || 'global';
  }, [allLessonsInModule]);
  const pinStorageKey = `levelspace_pinned_lessons_${moduleIdForPins}`;

  const [pinnedLessonIds, setPinnedLessonIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(pinStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Re-sync when module changes (navigating between modules)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(pinStorageKey);
      if (saved) {
        setPinnedLessonIds(JSON.parse(saved));
      } else if (otherLessons.length > 0) {
        // Default to first 3 other lessons if no pins are saved yet
        const defaultPins = otherLessons.slice(0, 3).map((l: any) => l.id);
        setPinnedLessonIds(defaultPins);
        localStorage.setItem(pinStorageKey, JSON.stringify(defaultPins));
      }
    } catch {
      setPinnedLessonIds([]);
    }
  }, [pinStorageKey, otherLessons.length]);

  // Clean up stale pin IDs that don't exist in the current module
  const validOtherLessonIds = useMemo(() => new Set(otherLessons.map((l: any) => l.id)), [otherLessons]);
  const validPinnedIds = useMemo(
    () => pinnedLessonIds.filter(id => validOtherLessonIds.has(id)),
    [pinnedLessonIds, validOtherLessonIds]
  );

  const togglePinLesson = (lessonId: string) => {
    setPinnedLessonIds(prev => {
      const next = prev.includes(lessonId) 
        ? prev.filter(id => id !== lessonId) 
        : [...prev, lessonId];
      localStorage.setItem(pinStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const [viewedBlockIds, setViewedBlockIds] = useState<Set<string>>(new Set());
  const [activeBlockId, setActiveBlockId] = useState<string | null>(displayedBlocks[0]?.id || null);
  const [speakingBlockId, setSpeakingBlockId] = useState<string | null>(null);

  // Audio speech boundary states for Karaoke visualizer
  const [speakingState, setSpeakingState] = useState<{
    activeSentence: string;
    activeWord: string;
  } | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (displayedBlocks.length > 0) {
      let initialId = displayedBlocks[0].id;
      if (startAtTest) {
        const testBlock = displayedBlocks.find(b => b.purpose === 'quiz' || b.purpose === 'practice' || b.purpose === 'exam');
        if (testBlock) {
          initialId = testBlock.id;
        }
      }
      setActiveBlockId(initialId);
      setViewedBlockIds(new Set([initialId]));
    }
    setSpeakingState(null);
    setIsSpeaking(false);
    setSpeakingBlockId(null);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [displayedBlocks, startAtTest]);

  // Scroll to test block if requested
  useEffect(() => {
    if (displayedBlocks.length > 0 && startAtTest) {
      const testBlock = displayedBlocks.find(b => b.purpose === 'quiz' || b.purpose === 'practice' || b.purpose === 'exam');
      if (testBlock) {
        setTimeout(() => {
          const el = document.getElementById(testBlock.id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 150);
      }
    }
  }, [displayedBlocks, startAtTest]);

  // IntersectionObserver to track viewed and active blocks
  useEffect(() => {
    if (displayedBlocks.length === 0) return;

    const observerOptions = {
      root: null,
      rootMargin: '-15% 0px -15% 0px',
      threshold: 0.1,
    };

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          setViewedBlockIds((prev) => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
          });
          setActiveBlockId(id);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, observerOptions);

    displayedBlocks.forEach((block) => {
      const el = document.getElementById(block.id);
      if (el) {
        observer.observe(el);
        if (blockRefs && blockRefs.current) {
          blockRefs.current[block.id] = el;
        }
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [displayedBlocks, blockRefs]);

  const viewedCount = viewedBlockIds.size;
  const totalBlocks = displayedBlocks.length;
  const progressPercent = totalBlocks > 0 ? Math.round((viewedCount / totalBlocks) * 100) : 0;

  const currentBlock = displayedBlocks.find((b) => b.id === activeBlockId) || displayedBlocks[0];

  const toggleSpeak = (text: string, blockId: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    if (isSpeaking && speakingBlockId === blockId) {
      setIsSpeaking(false);
      setSpeakingState(null);
      setSpeakingBlockId(null);
      return;
    }

    const cleanedText = text
      .replace(/[*#_`~]/g, '')
      .replace(/\$\$[\s\S]*?\$\$/g, 'mathematical formula')
      .replace(/\$.*?\$/g, 'formula');

    const sentences = cleanedText.match(/[^.!?]+[.!?]*/g) || [cleanedText];
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = 'fr-FR';

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const charIndex = event.charIndex;
        let totalLength = 0;
        let activeSentenceText = '';
        let activeWordInSentence = '';

        for (const sentence of sentences) {
          if (charIndex >= totalLength && charIndex < totalLength + sentence.length) {
            activeSentenceText = sentence;
            const relativeIndex = charIndex - totalLength;
            const words = sentence.split(/(\s+)/);
            let wordLength = 0;
            for (const w of words) {
              if (relativeIndex >= wordLength && relativeIndex < wordLength + w.length) {
                activeWordInSentence = w.trim();
                break;
              }
              wordLength += w.length;
            }
            break;
          }
          totalLength += sentence.length;
        }

        setSpeakingState({
          activeSentence: activeSentenceText,
          activeWord: activeWordInSentence
        });
      }
    };

    const resetSpeechStates = () => {
      setIsSpeaking(false);
      setSpeakingState(null);
      setSpeakingBlockId(null);
    };

    utterance.onend = resetSpeechStates;
    utterance.onerror = resetSpeechStates;

    setIsSpeaking(true);
    setSpeakingBlockId(blockId);
    window.speechSynthesis.speak(utterance);
  };

  const handleAskAITutor = (item: DisplayedLessonBlock) => {
    const text = getBlockReadText(item);
    const prompt = `I'm currently reading this section of my lesson on "${title}". Can you explain it to me in simple terms and help me understand its core concept? Section: "${item.title}" - Content: "${text.substring(0, 1000)}"`;

    window.dispatchEvent(
      new CustomEvent('open-ai-assistant', {
        detail: { initialInput: prompt }
      })
    );
  };

  const renderLessonCard = (lesson: any, isPinned: boolean) => {
    return (
      <div 
        key={lesson.id} 
        onClick={() => onNavigateToLesson?.(lesson.id)}
        className="bg-slate-50/50 dark:bg-surface-low/30 rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden flex flex-col group/preview transition-all relative cursor-pointer hover:border-slate-200/80 dark:hover:border-white/10 hover:scale-[1.005] active:scale-[0.99]"
      >
        {/* Pin Icon button in top-right */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); togglePinLesson(lesson.id); }}
          className={`absolute top-3 right-3 z-10 w-7 h-7 rounded-full flex items-center justify-center border backdrop-blur-md transition-all shadow-sm cursor-pointer ${
            isPinned
              ? 'bg-amber-500 border-amber-400 text-white shadow-amber-500/40 shadow-md'
              : 'bg-black/35 border-white/20 text-white/75 hover:text-white hover:bg-black/50'
          }`}
          title={isPinned ? 'Unpin Lesson' : 'Pin to Sidebar'}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill={isPinned ? "currentColor" : "none"} 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="w-3.5 h-3.5"
          >
            <line x1="12" y1="17" x2="12" y2="22"></line>
            <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.55A2 2 0 0 1 15 9.24V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.24a2 2 0 0 1-.78 1.21L5.44 14a2 2 0 0 0-.44 1.24Z"></path>
          </svg>
        </button>

        {/* Top Image Preview Banner */}
        <div className="h-28 w-full relative bg-slate-100 dark:bg-surface-low shrink-0 overflow-hidden border-b border-slate-100 dark:border-white/5">
          <img 
            src={lesson.bannerImage || getLessonIllustration(lesson.title, lesson.subject)}
            alt={lesson.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover/preview:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/35 flex items-end p-3">
            <div className="flex gap-1 flex-wrap">
              {lesson.subject && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 backdrop-blur-md text-[7px] font-black text-blue-200 uppercase tracking-wider border border-blue-500/30">
                  {lesson.subject}
                </span>
              )}
              {lesson.grade && (
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 backdrop-blur-md text-[7px] font-black text-purple-200 uppercase tracking-wider border border-purple-500/30">
                  {lesson.grade}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 flex-grow flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-900 dark:text-ink leading-tight select-none truncate">
              {lesson.title}
            </h3>

            {/* Outline Syllabus (collapsible or compact checklist) */}
            {lesson.blocks && Array.isArray(lesson.blocks) && lesson.blocks.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-white/5">
                <div className="max-h-24 overflow-y-auto pr-1 no-scrollbar space-y-1">
                  {lesson.blocks.map((block: any, idx: number) => {
                    const normalizedType = block.type || block.purpose || 'explanation';
                    const label = block.title || block.label || `${normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1)}`;
                    return (
                      <div key={idx} className="flex items-center gap-1.5 py-0.5 px-2 rounded-lg bg-slate-50 dark:bg-surface-low border border-slate-100 dark:border-white/5 text-[9px] text-slate-500 dark:text-ink-muted">
                        <span className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />
                        <span className="font-semibold truncate">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Action Button Indicator */}
          {onNavigateToLesson && (
            <div
              className="w-full bg-slate-900 group-hover/preview:bg-slate-800 dark:bg-white dark:group-hover/preview:bg-slate-50 text-white dark:text-slate-950 font-bold py-1.5 px-3 rounded-xl text-[10px] flex items-center justify-center gap-1 shadow-sm transition-all select-none"
            >
              <span>Start Study</span>
              <ChevronRight size={10} className="stroke-[3]" />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full md:h-full flex flex-col md:overflow-hidden bg-slate-50/50 dark:bg-background select-none">
      <SelectionActions />
      

      {/* Responsive Grid/Single Column Layout Container */}
      <main className="flex-grow min-h-0 w-full flex flex-col lg:flex-row gap-4 md:overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Main Content Column */}
        <div className="flex-grow flex flex-col min-h-0 w-full overflow-hidden">
        
        {/* Redesigned Card Container */}
        <div className="w-full h-full md:bg-white md:dark:bg-paper md:rounded-xl md:shadow-lg md:border md:border-slate-200 md:dark:border-white/8 overflow-hidden flex flex-col gap-3 md:gap-0 bg-transparent">
          
          {/* Header Area Card */}
          <div className="bg-white dark:bg-paper rounded-xl md:rounded-none border border-slate-200 dark:border-white/8 md:border-none shadow-md md:shadow-none overflow-hidden flex flex-col shrink-0">
            {/* Top Full-bleed Image Banner */}
            <div className="h-24 w-full relative bg-slate-100 dark:bg-surface-low shrink-0 overflow-hidden border-b border-slate-100 dark:border-white/5 group">
              <img 
                src={bannerImage || getLessonIllustration(title, subject)}
                alt={title}
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-[1.02] filter brightness-[0.75] dark:brightness-[0.6]"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
              
              {/* Overlaid Banner Content */}
              <div className="absolute inset-0 flex items-center justify-between px-6">
                <div className="flex items-center gap-4 min-w-0">
                  {/* Exit Button */}
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-white backdrop-blur-md transition-all duration-200 shadow-md cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                    title="Exit Lesson"
                  >
                    <ArrowLeft size={14} className="stroke-[2.5]" />
                  </button>
                  
                  {/* Title & Context */}
                  <div className="min-w-0">
                    <span className="block text-[10px] font-extrabold text-white/60 uppercase tracking-widest truncate leading-none mb-1">
                      {[grade, subject].filter(Boolean).join(' · ')}
                    </span>
                    <h2 className="text-base md:text-lg font-extrabold text-white tracking-tight leading-tight select-none truncate">
                      {title}
                    </h2>
                  </div>
                </div>

                {/* Banner Actions (Tools & Banner Edit) */}
                <div className="flex items-center gap-2 shrink-0">
                  {onUpdateBanner && (
                    <button
                      type="button"
                      onClick={() => setShowImagePicker(true)}
                      className="h-8 px-2.5 rounded-full bg-black/45 hover:bg-black/60 border border-white/10 text-white text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-sm cursor-pointer"
                      title="Customize Banner Image"
                    >
                      <Camera size={11} className="stroke-[2.5]" />
                      <span>Edit Banner</span>
                    </button>
                  )}
                  {currentBlock && (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleSpeak(getBlockReadText(currentBlock), currentBlock.id)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all backdrop-blur-md cursor-pointer hover:scale-105 ${
                          isSpeaking 
                            ? 'bg-accent/30 border-accent text-accent animate-pulse' 
                            : 'bg-black/40 border-white/10 text-white/90 hover:bg-black/60'
                        }`}
                        title="Read Aloud"
                      >
                        <Volume2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAskAITutor(currentBlock)}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-black/45 border border-white/10 text-white/90 hover:bg-black/60 backdrop-blur-md transition-all cursor-pointer hover:scale-105"
                        title="Ask AI Assistant"
                      >
                        <Bot size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Sub-header Ribbon for Progress and Domain Filters */}
            <div className="bg-slate-50 dark:bg-surface-low border-b border-slate-100 dark:border-white/5 px-6 py-2 flex items-center justify-between gap-4 shrink-0 flex-wrap md:flex-nowrap">
              {/* Progress info */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-ink-muted">
                  Progress
                </span>
                <div className="w-[100px] bg-slate-200 dark:bg-surface-mid h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400">
                  {totalBlocks > 0 ? `${viewedCount}/${totalBlocks}` : '0/0'}
                </span>

                {/* Draft Pill */}
                {draftWarning && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold uppercase tracking-wider dark:bg-amber-900/30 dark:text-amber-400 ml-2">
                    <AlertTriangle size={10} /> Draft
                  </span>
                )}
              </div>

              {/* Domain Pills */}
              {showDomainFilters && allBlocks.length > 0 && (
                <div className="flex gap-2 items-center overflow-x-auto no-scrollbar py-0.5 max-w-full">
                  <button
                    type="button"
                    onClick={() => onDomainChange('all')}
                    className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                      activeDomain === 'all' 
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-surface-mid dark:text-ink-muted'
                    }`}
                  >
                    All {allBlocks.length}
                  </button>
                  {domainStats.map((domain) => (
                    <button
                      key={domain.code}
                      type="button"
                      onClick={() => onDomainChange(domain.code)}
                      className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                        activeDomain === domain.code 
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950' 
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-surface-mid dark:text-ink-muted'
                      }`}
                    >
                      {domain.name} {domain.count}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Vertical scrollable container covering all blocks */}
          <div className="lesson-player-container flex-1 min-h-0 flex flex-col relative overflow-hidden bg-white dark:bg-paper rounded-xl md:rounded-none border border-slate-200 dark:border-white/8 md:border-none shadow-md md:shadow-none">
            
            {/* Scrollable Content Area */}
            <div className="lesson-player-content-area flex-grow overflow-y-auto no-scrollbar flex flex-col justify-start space-y-6 p-6 min-w-0 h-full">
              
              {/* Speech Boundary Karaoke visualizer panel */}
              {isSpeaking && speakingState && speakingState.activeSentence && (
                <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center gap-3 shadow-lg border border-white/10 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex gap-1 items-center shrink-0">
                    <span className="w-1.5 h-3.5 bg-accent rounded-full animate-pulse" />
                    <span className="w-1.5 h-5 bg-accent rounded-full animate-pulse delay-75" />
                    <span className="w-1.5 h-2 bg-accent rounded-full animate-pulse delay-150" />
                  </div>
                  <p className="text-xs leading-relaxed flex-grow">
                    {speakingState.activeSentence.split(/(\s+)/).map((part, index) => {
                      const isWord = part.trim() === speakingState.activeWord;
                      return (
                        <span 
                          key={index} 
                          className={`transition-all duration-100 ${isWord ? 'text-amber-400 font-black text-[13px] scale-105 mx-0.5 inline-block' : 'text-white/70'}`}
                        >
                          {part}
                        </span>
                      );
                    })}
                  </p>
                </div>
              )}

              {/* Display blocks */}
              <div className="flex-grow flex flex-col space-y-8 divide-y divide-slate-100 dark:divide-white/5">
                {displayedBlocks.length > 0 ? (
                  displayedBlocks.map((block, index) => {
                    const isViewed = viewedBlockIds.has(block.id);
                    const isBlockReading = isSpeaking && speakingBlockId === block.id;

                    return (
                      <div 
                        key={block.id} 
                        id={block.id}
                        className={`w-full flex flex-col ${index > 0 ? 'pt-8' : ''}`}
                      >
                        <div className="pt-2 text-slate-700 leading-relaxed dark:text-ink-secondary">
                          <LessonBlock
                            item={block}
                            isViewed={isViewed}
                            reading={isBlockReading}
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
                            onSpeak={() => toggleSpeak(getBlockReadText(block), block.id)}
                            onAskAI={() => handleAskAITutor(block)}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-slate-400 dark:text-ink-muted bg-slate-50/50 dark:bg-surface-low rounded-2xl border border-solid border-slate-200/60 dark:border-white/5">
                    No sections found in this lesson view.
                  </div>
                )}
              </div>

              {/* Completion & Navigation Footer */}
              {displayedBlocks.length > 0 && (
                <div className="mt-12 pt-8 border-t border-slate-100 dark:border-white/5 space-y-6">
                  {/* Completion Card */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50 dark:bg-surface-low p-6 rounded-2xl border border-slate-100 dark:border-white/5">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-ink">
                        {t('lesson_summary_completed') || 'You have reached the end of the lesson!'}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-ink-muted mt-1">
                        All sections have been loaded. {hasTests ? 'Take the test to verify your knowledge.' : 'Feel free to review the sections or proceed.'}
                      </p>
                    </div>
                    {hasTests && onTakeTest && (
                      <button
                        type="button"
                        onClick={onTakeTest}
                        className="inline-flex items-center justify-center gap-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-600/10 shrink-0"
                      >
                        <CheckCircle2 size={16} />
                        Take Test
                      </button>
                    )}
                  </div>

                  {/* Navigation Links */}
                  <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pt-4">
                    {prevLesson ? (
                      <button
                        type="button"
                        onClick={() => onNavigateToLesson?.(prevLesson.id)}
                        className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-ink-secondary hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-2.5 px-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-blue-600/30 dark:hover:border-blue-400/30 bg-white dark:bg-paper cursor-pointer text-left"
                      >
                        <ChevronLeft size={16} />
                        <span>Previous Lesson: {prevLesson.title}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-ink-secondary hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-2.5 px-4 rounded-xl border border-slate-200 dark:border-white/10 cursor-pointer"
                      >
                        <ArrowLeft size={14} />
                        <span>Back to Syllabus</span>
                      </button>
                    )}

                    {nextLesson && (
                      <button
                        type="button"
                        onClick={() => onNavigateToLesson?.(nextLesson.id)}
                        className="flex items-center justify-center gap-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all py-2.5 px-5 rounded-xl shadow-md shadow-blue-600/15 cursor-pointer sm:ml-auto"
                      >
                        <span>Next Lesson: {nextLesson.title}</span>
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>

          </div>

          <div className="px-6 pb-4 bg-white dark:bg-paper flex justify-center items-center gap-1.5 text-[10px] text-slate-400 dark:text-ink-muted border-t border-slate-50 dark:border-white/5 pt-3">
            <Info size={11} className="shrink-0" />
            <span>Highlight any word in the content card for automatic vocabulary assistance.</span>
          </div>

        </div>
      </div>

      {/* Column 3: Dynamic Widgets & Lesson Previews Sidebar (260px width) */}
      <div className="hidden lg:flex lg:w-[260px] w-full shrink-0 h-full bg-white dark:bg-paper rounded-xl shadow-lg border border-slate-200 dark:border-white/8 overflow-hidden flex-col p-4">
        <div className="flex-grow overflow-y-auto no-scrollbar pr-1 flex flex-col gap-6">
          
          {/* Focus Timer */}
          <section className="bg-slate-950 text-white rounded-2xl p-5 relative overflow-hidden group dark:bg-surface-low dark:text-ink shrink-0">
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider dark:text-ink-muted">{t('deep_focus') || 'Deep Focus'}</h3>
                <div className="text-3xl font-bold tracking-tight mt-1 mb-3">
                  {(() => {
                    const mins = Math.floor(timerSeconds / 60);
                    const secs = timerSeconds % 60;
                    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                  })()}
                </div>
              </div>
              <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center ${isTimerRunning ? 'border-accent text-accent animate-pulse' : 'border-slate-800 text-slate-600 dark:border-slate-200 dark:text-slate-400'}`}>
                <Timer size={20} />
              </div>
            </div>
            <div className="relative z-10 flex gap-2">
              <button
                type="button"
                onClick={() => onTimerRunningChange(!isTimerRunning)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isTimerRunning
                    ? 'bg-slate-800 text-white hover:bg-slate-700 dark:bg-surface-mid dark:text-ink'
                    : 'bg-accent text-white hover:bg-accent/90'
                }`}
              >
                {isTimerRunning ? (t('pause') || 'Pause') : (t('dashboard_start') || 'Start Timer')}
              </button>
              <button
                type="button"
                onClick={onTimerReset}
                className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-700 transition-all dark:bg-surface-mid dark:text-ink-muted"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </section>

          {/* Support Zone / MyLevel */}
          <section className="bg-slate-950 text-white rounded-2xl p-5 relative overflow-hidden group dark:bg-surface-low dark:text-ink shrink-0">
            <div className="relative z-10 flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider dark:text-ink-muted">Support Zone</h3>
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-accent/30 text-accent flex items-center justify-center bg-accent/10">
                <Activity size={18} className="text-accent" />
              </div>
            </div>
            <div className="relative z-10 space-y-4">
              <p className="text-sm font-medium text-slate-300 dark:text-ink-secondary leading-relaxed text-xs">
                Check your real level, discover your gaps, and get a personal roadmap.
              </p>
              <button
                onClick={() => onSupportModalOpenChange(true)}
                className="w-full py-2.5 rounded-xl text-xs font-bold transition-all bg-accent text-white hover:bg-accent/90"
              >
                Start MyLevel Check
              </button>
            </div>
          </section>

          {/* Classroom Activity Log */}
          <section className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-950 dark:text-ink">{t('activity_log') || 'Classroom Activity'}</h3>
              <span className="text-[9px] bg-slate-50 dark:bg-surface-low border border-slate-100 dark:border-white/5 text-slate-400 dark:text-ink-muted px-2 py-0.5 rounded-full font-bold">LIVE</span>
            </div>
            
            <div className="space-y-3.5 max-h-[200px] overflow-y-auto no-scrollbar">
              {activityLogs.length > 0 ? (
                activityLogs.map((log) => {
                  const relativeTimeText = (() => {
                    const diff = Date.now() - log.timestamp;
                    const minutes = Math.floor(diff / 60000);
                    if (minutes < 60) return `${minutes}m ago`;
                    const hours = Math.floor(minutes / 60);
                    if (hours < 24) return `${hours}h ago`;
                    const days = Math.floor(hours / 24);
                    return `${days}d ago`;
                  })();

                  return (
                    <div key={log.id} className="flex gap-3 items-start text-xs">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        log.type === 'lesson_completed'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : log.type === 'note_added'
                          ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                          : log.type === 'pomodoro_start'
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                          : log.type === 'reminder_completed'
                          ? 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400'
                          : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                      }`}>
                        {log.type === 'lesson_completed' ? (
                          <CheckCircle2 size={14} />
                        ) : log.type === 'note_added' ? (
                          <FileText size={14} />
                        ) : log.type === 'pomodoro_start' ? (
                          <Timer size={14} />
                        ) : log.type === 'reminder_completed' ? (
                          <CheckSquare size={14} />
                        ) : (
                          <Loader2 size={14} className="animate-spin" />
                        )}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <h4 className="font-bold text-slate-950 dark:text-ink truncate leading-snug text-[11px]" title={log.title}>
                          {log.title}
                        </h4>
                        {log.subtitle && (
                          <p className="text-[10px] text-slate-500 dark:text-ink-muted leading-relaxed line-clamp-1">
                            {log.subtitle}
                          </p>
                        )}
                        <p className="text-[9px] text-slate-400 dark:text-ink-muted">
                          {relativeTimeText}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center bg-slate-50/30 dark:bg-surface-low/10 rounded-xl border border-solid border-slate-100 dark:border-white/5">
                  <p className="text-[10px] font-medium text-slate-400 dark:text-ink-muted">
                    No recent activity. Start or review a lesson to log your progress!
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Module Outline - rendered below the widgets */}
          {otherLessons.length > 0 && (
            <section className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5 shrink-0">
              <h3 className="text-xs font-black text-slate-900 dark:text-ink uppercase tracking-wider">Module Syllabus</h3>
              <div className="flex flex-col gap-4 max-h-[320px] overflow-y-auto pr-1 no-scrollbar">
                {(() => {
                  const pinnedLessons = otherLessons.filter((l: any) => validPinnedIds.includes(l.id));
                  const unpinnedLessons = otherLessons.filter((l: any) => !validPinnedIds.includes(l.id));

                  return (
                    <div className="flex flex-col gap-4">
                      <AnimatePresence mode="popLayout">
                        {pinnedLessons.map(lesson => (
                          <motion.div
                            key={lesson.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                          >
                            {renderLessonCard(lesson, true)}
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      <AnimatePresence mode="popLayout">
                        {unpinnedLessons.map(lesson => (
                          <motion.div
                            key={lesson.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
                          >
                            {renderLessonCard(lesson, false)}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      
                      {unpinnedLessons.length === 0 && (
                        <div className="p-4 text-center bg-slate-50 dark:bg-surface-low rounded-xl border border-solid border-slate-200/50 dark:border-white/5 opacity-60">
                          <p className="text-[9px] font-black text-slate-500 dark:text-ink-muted uppercase tracking-wider">All lessons pinned above</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </section>
          )}

        </div>
      </div>
    </main>

      {onUpdateBanner && (
        <BannerImagePicker
          isOpen={showImagePicker}
          onClose={() => setShowImagePicker(false)}
          onSelect={onUpdateBanner}
          currentBannerUrl={bannerImage}
        />
      )}
    </div>
  );
};
