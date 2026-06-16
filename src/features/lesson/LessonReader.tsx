import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
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
  ChevronLeft,
  FileText,
  HelpCircle,
  Dumbbell,
  PenTool,
  ListChecks,
  Volume2,
  Bot,
  Award,
  AlertTriangle,
  Timer,
  RefreshCw,
  Activity,
  CheckSquare,
  Loader2
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

const cleanLessonTitle = (value: string) =>
  value
    .replace(/\.(pdf|docx?|pptx?)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
  prevLesson,
  nextLesson,
  onNavigateToLesson,
  onTakeTest,
  hasTests,
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
  const { t, language } = useLanguage();
  const contentScrollRef = React.useRef<HTMLDivElement | null>(null);
  
  const otherLessons = useMemo(() => {
    return (allLessonsInModule || []).filter((l: any) => l.title !== title);
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

  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(displayedBlocks[0]?.id || null);
  const [viewedBlockIds, setViewedBlockIds] = useState<Set<string>>(new Set());
  const [activeBlockId, setActiveBlockId] = useState<string | null>(displayedBlocks[0]?.id || null);
  // Slide direction: +1 = moving forward (next), -1 = moving backward (prev)
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);

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
      setExpandedBlockId(initialId);
      setActiveBlockId(initialId);
      setViewedBlockIds(new Set(displayedBlocks.map((block) => block.id)));
    }
    setSpeakingState(null);
    setIsSpeaking(false);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [displayedBlocks, startAtTest]);

  const viewedCount = displayedBlocks.filter((item) => viewedBlockIds.has(item.id)).length;
  const totalBlocks = displayedBlocks.length;
  const currentBlockIndex = Math.max(0, displayedBlocks.findIndex((b) => b.id === expandedBlockId));
  const progressPercent = totalBlocks > 0 ? Math.round((viewedCount / totalBlocks) * 100) : 0;

  const currentBlock = displayedBlocks[currentBlockIndex] || displayedBlocks[0];
  const hasNextDestination = currentBlockIndex < displayedBlocks.length - 1 || !!nextLesson;

  useEffect(() => {
    contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentBlock?.id, title]);

  const handleContinue = () => {
    if (displayedBlocks.length === 0) return;
    if (currentBlockIndex < displayedBlocks.length - 1) {
      const nextBlock = displayedBlocks[currentBlockIndex + 1];
      setSlideDirection(1);
      setExpandedBlockId(nextBlock.id);
      setActiveBlockId(nextBlock.id);
      setViewedBlockIds((prev) => {
        if (prev.has(nextBlock.id)) return prev;
        const next = new Set(prev);
        next.add(nextBlock.id);
        return next;
      });
      // Stop active speech
      setSpeakingState(null);
      setIsSpeaking(false);
      window.speechSynthesis.cancel();
    } else if (nextLesson) {
      onNavigateToLesson?.(nextLesson.id);
    }
  };

  const handleBackSection = () => {
    if (currentBlockIndex > 0) {
      const prevBlock = displayedBlocks[currentBlockIndex - 1];
      setSlideDirection(-1);
      setExpandedBlockId(prevBlock.id);
      setActiveBlockId(prevBlock.id);
      setSpeakingState(null);
      setIsSpeaking(false);
      window.speechSynthesis.cancel();
    } else if (prevLesson) {
      onNavigateToLesson?.(prevLesson.id);
    } else {
      onBack();
    }
  };

  const toggleSpeak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    if (isSpeaking) {
      setIsSpeaking(false);
      setSpeakingState(null);
      return;
    }

    const cleanedText = text
      .replace(/[*#_`~]/g, '')
      .replace(/\$\$[\s\S]*?\$\$/g, 'mathematical formula')
      .replace(/\$.*?\$/g, 'formula');

    const sentences = cleanedText.match(/[^.!?]+[.!?]*/g) || [cleanedText];
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = 'fr-FR'; // french lesson default matching original speech synthesizers

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
    };

    utterance.onend = resetSpeechStates;
    utterance.onerror = resetSpeechStates;

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleAskAITutor = (item: DisplayedLessonBlock) => {
    const text = getBlockReadText(item);
    const lessonName = cleanLessonTitle(title);
    const rawTitle = cleanLessonTitle(String(item.title || ''));
    const firstContentHeading = text
      .split('\n')
      .map(line => cleanLessonTitle(line.replace(/^#+\s*/, '')))
      .find(line => line && line !== lessonName && !/\.(pdf|docx?|pptx?)$/i.test(line));
    const sectionTitle = firstContentHeading || rawTitle || lessonName;
    const lowerContext = `${subject || ''} ${lessonName} ${sectionTitle} ${text.slice(0, 500)}`.toLowerCase();
    const shouldUseFrench =
      language === 'fr' ||
      lowerContext.includes('français') ||
      lowerContext.includes('francais') ||
      /\b(le|la|les|un|une|des|verbe|phrase|sujet|cours)\b/.test(lowerContext) ||
      /[àâçéèêëîïôùûüÿœ]/i.test(lowerContext);
    let prompt = shouldUseFrench
      ? `J'ai besoin d'aide sur cette section : "${sectionTitle}".`
      : `I need help with this section: "${sectionTitle}". Help me find exactly what is difficult.`;
    if (shouldUseFrench) {
      prompt = `J'ai besoin d'aide sur cette section : "${sectionTitle}". Aide-moi a trouver exactement ce qui est difficile.`;
    }

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
    <div className="w-full min-h-full lg:h-full flex flex-col overflow-hidden bg-slate-50/50 dark:bg-background">
      

      {/* Responsive Grid/Single Column Layout Container */}
      <main className="flex-grow min-h-0 w-full min-w-0 flex flex-col lg:flex-row gap-4 overflow-visible lg:overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Main Content Column */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-visible lg:overflow-hidden">
        
        {/* Redesigned Card Container */}
        <div className="w-full min-w-0 h-[calc(100dvh-9.5rem)] min-h-[520px] lg:h-full lg:min-h-0 bg-white dark:bg-paper rounded-xl shadow-lg border border-slate-200 dark:border-white/8 overflow-hidden flex flex-col">
          
          {/* Compact Progress, Filters & Tools Ribbon */}
          <div className="bg-slate-50 border-b border-slate-100 dark:bg-surface-low dark:border-white/5 flex flex-col items-stretch justify-between px-3 py-2 shrink-0 gap-2 sm:flex-row sm:items-center sm:px-5">
            
            <div className="flex min-w-0 flex-grow items-center gap-3 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={onBack}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 dark:border-white/10 dark:bg-paper dark:text-ink-secondary dark:hover:bg-surface-mid"
                title="Exit Lesson"
              >
                <ArrowLeft size={12} className="stroke-[2.5]" />
                <span>Exit</span>
              </button>

              {/* Thin Progress Bar */}
              <div className="w-[96px] shrink-0 flex items-center gap-3 sm:w-[120px]" title={`Progress: ${progressPercent}%`}>
                <div className="w-full bg-slate-200 dark:bg-surface-mid h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-normal text-slate-500 dark:text-ink-muted">
                {[grade, subject, totalBlocks > 0 ? `${totalBlocks} sections` : null].filter(Boolean).join(' · ')}
              </span>

              {/* Draft Pill */}
              {draftWarning && (
                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold uppercase tracking-wider dark:bg-amber-900/30 dark:text-amber-400">
                  <AlertTriangle size={10} /> Draft
                </span>
              )}
              
              {/* Domain filtering */}
              {showDomainFilters && allBlocks.length > 0 && (
                <div className="flex gap-2 items-center select-none shrink-0 border-l border-slate-200 dark:border-white/10 pl-3">
                  <button
                    type="button"
                    onClick={() => onDomainChange('all')}
                    className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider transition-all ${
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
                      className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider transition-all ${
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

            {/* Right: Tools (Speaker & AI) */}
            <div className="flex items-center gap-2 shrink-0 sm:border-l sm:border-slate-200 sm:dark:border-white/10 sm:pl-4">
              {currentBlock && (
                <>
                  <button
                    type="button"
                    onClick={() => toggleSpeak(getBlockReadText(currentBlock))}
                    className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                      isSpeaking 
                        ? 'bg-accent/15 border-accent text-accent animate-pulse' 
                        : 'border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-surface-mid'
                    }`}
                    title="Read Aloud"
                  >
                    <Volume2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAskAITutor(currentBlock)}
                    className="w-7 h-7 rounded-full flex items-center justify-center border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-surface-mid"
                    title="Ask AI Assistant"
                  >
                    <Bot size={13} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Single Horizontal Content Block Player */}
          <div className="flex-grow min-h-0 flex flex-row relative overflow-hidden">
            
            {/* Left Nav */}
            <div className="hidden">
              <button
                type="button"
                onClick={handleBackSection}
                className="pointer-events-auto flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-sm transition-all dark:bg-paper/95 dark:border-white/10 dark:text-ink-secondary dark:hover:bg-surface-low cursor-pointer hover:scale-105 group"
                title={currentBlockIndex > 0 ? 'Previous Section' : prevLesson ? 'Previous Lesson' : 'Back'}
              >
                {currentBlockIndex > 0 ? <ChevronLeft size={20} /> : <ArrowLeft size={16} />}
              </button>
            </div>

            {/* Main Content Area */}
            <div ref={contentScrollRef} data-smart-select-scope="true" className="flex-1 basis-0 min-h-0 overflow-y-auto no-scrollbar flex flex-col justify-start space-y-4 pt-3 pb-20 min-w-0 px-4 sm:px-2 overscroll-contain">
              
              {/* Speech Boundary Karaoke visualizer panel */}
              {isSpeaking && speakingState && speakingState.activeSentence && (
                <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center gap-3 shadow-lg border border-white/10 animate-in slide-in-from-top-2 duration-300 mx-2">
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

              {/* Display blocks — Slide animation via AnimatePresence */}
              <div className="mx-auto w-full max-w-[760px] px-0 sm:px-2">
                {displayedBlocks.length > 0 ? (() => {
                  return (
                    <div className="flex flex-col divide-y divide-slate-100 dark:divide-white/5">
                      {displayedBlocks.map((block) => (
                        <div
                          key={block.id}
                          className="py-5 first:pt-2 last:pb-2 text-slate-700 leading-relaxed dark:text-ink-secondary select-text"
                        >
                          <LessonBlock
                            item={block}
                            isViewed={viewedBlockIds.has(block.id)}
                            reading={isSpeaking && block.id === currentBlock?.id}
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
                      ))}

                      <div className="flex items-center justify-between pt-5">
                        <span className="text-[10px] text-slate-400 dark:text-ink-muted italic">Résumé de la leçon completed</span>
                        {hasTests ? (
                          <button
                            type="button"
                            onClick={() => {
                              const testBlock = displayedBlocks.find(b => b.purpose === 'quiz' || b.purpose === 'practice' || b.purpose === 'exam');
                              if (testBlock) {
                                setExpandedBlockId(testBlock.id);
                                setActiveBlockId(testBlock.id);
                                document.getElementById(testBlock.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }
                            }}
                            className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-[#1B8354] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-3 py-1.5 rounded-full transition-all cursor-pointer shadow-sm"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Take Test
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-ink-muted">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            No test available
                          </span>
                        )}
                      </div>
                    </div>
                  );

                  const currentBlock = displayedBlocks[currentBlockIndex];
                  if (!currentBlock) return null;
                  const isViewed = viewedBlockIds.has(currentBlock.id);

                  const slideVariants = {
                    enter: (dir: number) => ({ x: dir > 0 ? 28 : -28, y: 8, opacity: 0 }),
                    center: { x: 0, y: 0, opacity: 1 },
                    exit: (dir: number) => ({ x: dir > 0 ? -28 : 28, y: -8, opacity: 0 }),
                  };

                  return (
                    <AnimatePresence mode="wait" custom={slideDirection}>
                      <motion.div
                        key={currentBlock.id}
                        custom={slideDirection}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="w-full flex flex-col space-y-4"
                      >
                        <div className="pt-2 text-slate-700 leading-relaxed dark:text-ink-secondary select-text">
                          <LessonBlock
                            item={currentBlock}
                            isViewed={isViewed}
                            reading={isSpeaking}
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

                          {/* Available status tag for summary block */}
                          {currentBlockIndex === displayedBlocks.length - 1 && (
                            <div className="flex items-center justify-between mt-6 pt-3 border-t border-slate-100 dark:border-white/5">
                              <span className="text-[10px] text-slate-400 dark:text-ink-muted italic">Résumé de la leçon completed</span>
                              {hasTests ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const testBlock = displayedBlocks.find(b => b.purpose === 'quiz' || b.purpose === 'practice' || b.purpose === 'exam');
                                    if (testBlock) {
                                      setSlideDirection(1);
                                      setExpandedBlockId(testBlock.id);
                                      setActiveBlockId(testBlock.id);
                                      setViewedBlockIds(prev => {
                                        const next = new Set(prev);
                                        next.add(testBlock.id);
                                        return next;
                                      });
                                    }
                                  }}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-[#1B8354] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-3 py-1.5 rounded-full transition-all cursor-pointer shadow-sm animate-pulse"
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Take Test
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-ink-muted">
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                  No test available
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  );
                })() : (
                  <div className="text-center py-12 text-slate-400 dark:text-ink-muted bg-slate-50/50 dark:bg-surface-low rounded-2xl border border-solid border-slate-200/60 dark:border-white/5">
                    No sections found in this lesson view.
                  </div>
                )}
              </div>

            </div>

            {/* Right Nav */}
            <div className="hidden">
               <button 
                  type="button"
                  onClick={handleContinue}
                  disabled={!hasNextDestination}
                  className="pointer-events-auto flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition-all cursor-pointer hover:scale-105 group disabled:cursor-default disabled:opacity-40 disabled:hover:scale-100"
                  title={currentBlockIndex === displayedBlocks.length - 1 ? (nextLesson ? 'Next Lesson' : t('complete')) : t('continue')}
                >
                  <ChevronRight size={20} className="stroke-[3]" />
                </button>
            </div>

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

    </div>
  );
};
