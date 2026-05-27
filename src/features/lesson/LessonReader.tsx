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
  Info,
  Camera,
  Award,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LessonBlock } from './LessonBlock';
import { LessonToolsMenu } from './LessonToolsMenu';
import type { DisplayedLessonBlock, LessonDomainStat } from './useDisplayedLessonBlocks';
import { BannerImagePicker } from '../../components/BannerImagePicker';

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
  prevLesson,
  nextLesson,
  onNavigateToLesson,
  onTakeTest,
  hasTests,
  bannerImage,
  onUpdateBanner,
  startAtTest,
  allLessonsInModule = [],
}) => {
  const { t } = useLanguage();
  const [showImagePicker, setShowImagePicker] = useState(false);
  
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
      setViewedBlockIds(new Set([initialId]));
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
  const progressPercent = totalBlocks > 0 ? Math.round(((currentBlockIndex + 1) / totalBlocks) * 100) : 0;

  const currentBlock = displayedBlocks[currentBlockIndex] || displayedBlocks[0];

  const handleContinue = () => {
    if (displayedBlocks.length === 0) return;
    if (currentBlockIndex < displayedBlocks.length - 1) {
      const nextBlock = displayedBlocks[currentBlockIndex + 1];
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
    } else {
      onBack();
    }
  };

  const handleBackSection = () => {
    if (currentBlockIndex > 0) {
      const prevBlock = displayedBlocks[currentBlockIndex - 1];
      setExpandedBlockId(prevBlock.id);
      setActiveBlockId(prevBlock.id);
      setSpeakingState(null);
      setIsSpeaking(false);
      window.speechSynthesis.cancel();
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
        className="bg-white dark:bg-paper rounded-2xl border border-slate-200 dark:border-white/8 shadow-md overflow-hidden flex flex-col group/preview transition-all hover:shadow-lg relative cursor-pointer hover:border-slate-300 dark:hover:border-white/15 hover:scale-[1.005] active:scale-[0.99]"
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
    <div className="lesson-reader-shell min-h-screen bg-slate-50/50 dark:bg-background pb-20 select-none">
      

      {/* Responsive Grid/Single Column Layout Container */}
      <main className={hasSidebar
        ? "max-w-7xl mx-auto mt-6 px-6 grid grid-cols-1 lg:grid-cols-3 gap-5 lg:h-[calc(100vh-7rem)] lg:max-h-[calc(100vh-7rem)] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500"
        : "max-w-2xl mx-auto mt-8 px-4 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-500"
      }>
        
        {/* Main Content Column */}
        <div className={hasSidebar
          ? "lg:col-span-2 flex flex-col h-full w-full overflow-hidden"
          : "w-full flex flex-col justify-start"
        }>
        
        {/* Redesigned Card Container */}
        <div className="w-full h-full bg-white dark:bg-paper rounded-3xl shadow-lg border border-slate-200 dark:border-white/8 overflow-hidden flex flex-col">
          
          {/* Top Full-bleed Image Banner */}
          <div className="h-28 w-full relative bg-slate-100 dark:bg-surface-low shrink-0 overflow-hidden border-b border-slate-100 dark:border-white/5 group">
            <img 
              src={bannerImage || getLessonIllustration(title, subject)}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-[1.02]"
            />
            {/* Tint Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-black/35 flex items-center justify-center px-4" />
            
            {/* Center Lesson Title */}
            <h2 className="absolute inset-0 flex items-center justify-center text-center font-display font-black text-xl tracking-wide text-white drop-shadow-md uppercase px-8 select-none">
              {title}
            </h2>

            {/* Custom Banner Edit Button */}
            {onUpdateBanner && (
              <button
                type="button"
                onClick={() => setShowImagePicker(true)}
                className="absolute top-4 left-4 z-10 bg-black/45 hover:bg-black/60 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-sm cursor-pointer"
                title="Customize Banner Image"
              >
                <Camera size={12} className="stroke-[2.5]" />
                <span>Edit Banner</span>
              </button>
            )}
          </div>

          {/* Compact Progress, Filters & Tools Ribbon */}
          <div className="bg-slate-50 border-b border-slate-100 dark:bg-surface-low dark:border-white/5 flex items-center justify-between px-6 py-2 shrink-0 gap-4">
            
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar flex-grow">
              {/* Thin Progress Bar */}
              <div className="w-[120px] shrink-0 flex items-center gap-3" title={`Progress: ${progressPercent}%`}>
                <div className="w-full bg-slate-200 dark:bg-surface-mid h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Draft Pill */}
              {draftWarning && (
                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold uppercase tracking-wider dark:bg-amber-900/30 dark:text-amber-400">
                  <AlertTriangle size={10} /> Draft
                </span>
              )}
              
              {/* Domain filtering */}
              {showDomainFilters && allBlocks.length > 0 && (
                <div className="flex gap-2 items-center select-none shrink-0 border-l border-slate-200 dark:border-white/10 pl-4">
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
            <div className="flex items-center gap-2 shrink-0 border-l border-slate-200 dark:border-white/10 pl-4">
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
          <div className="flex-grow min-h-[400px] flex flex-row relative overflow-hidden h-full">
            
            {/* Left Nav */}
            <div className="w-12 sm:w-16 shrink-0 flex flex-col items-center justify-center relative z-10">
               {prevLesson ? (
                  <button
                    type="button"
                    onClick={() => onNavigateToLesson?.(prevLesson.id)}
                    className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-sm transition-all dark:bg-paper dark:border-white/10 dark:text-ink-secondary dark:hover:bg-surface-low cursor-pointer hover:scale-110 group"
                    title="Previous Lesson"
                  >
                    <ArrowLeft size={16} />
                  </button>
                ) : currentBlockIndex > 0 ? (
                  <button
                    type="button"
                    onClick={handleBackSection}
                    className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-sm transition-all dark:bg-paper dark:border-white/10 dark:text-ink-secondary dark:hover:bg-surface-low cursor-pointer hover:scale-110 group"
                    title="Previous Section"
                  >
                    <ChevronLeft size={20} />
                  </button>
                ) : null}
            </div>

            {/* Main Content Area */}
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col justify-start space-y-4 pt-4 pb-12 min-w-0 px-2 h-full">
              
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

              {/* Display blocks */}
              <div className="flex-grow px-2">
                {displayedBlocks.length > 0 ? (() => {
                  const currentBlock = displayedBlocks[currentBlockIndex];
                  if (!currentBlock) return null;
                  const isViewed = viewedBlockIds.has(currentBlock.id);

                  return (
                    <div className="w-full h-full flex flex-col space-y-4 relative">
                      <div className="pt-2 text-slate-700 leading-relaxed dark:text-ink-secondary">
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
                    </div>
                  );
                })() : (
                  <div className="text-center py-12 text-slate-400 dark:text-ink-muted bg-slate-50/50 dark:bg-surface-low rounded-2xl border border-solid border-slate-200/60 dark:border-white/5">
                    No sections found in this lesson view.
                  </div>
                )}
              </div>

            </div>

            {/* Right Nav */}
            <div className="w-12 sm:w-16 shrink-0 flex flex-col items-center justify-center relative z-10">
               <button 
                  type="button"
                  onClick={handleContinue}
                  className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition-all cursor-pointer hover:scale-110 group"
                  title={currentBlockIndex === displayedBlocks.length - 1 ? t('complete') : t('continue')}
                >
                  <ChevronRight size={20} className="stroke-[3]" />
                </button>
            </div>

          </div>

          <div className="px-6 pb-4 bg-white dark:bg-paper flex justify-center items-center gap-1.5 text-[10px] text-slate-400 dark:text-ink-muted border-t border-slate-50 dark:border-white/5 pt-3">
            <Info size={11} className="shrink-0" />
            <span>Highlight any word in the content card for automatic vocabulary assistance.</span>
          </div>

        </div>
      </div>

      {/* Column 3: Suggestions & Next Lesson Preview Sidebar (1/3 width) - Rendered only if there are other lessons */}
      {hasSidebar && (
        <div className="lg:col-span-1 h-full w-full overflow-y-auto no-scrollbar pr-1 pb-4 flex flex-col gap-4">
          {(() => {
            const pinnedLessons = otherLessons.filter((l: any) => validPinnedIds.includes(l.id));
            const unpinnedLessons = otherLessons.filter((l: any) => !validPinnedIds.includes(l.id));

            return (
              <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                {/* Pinned study desk header & cards */}
                <AnimatePresence mode="popLayout">
                {pinnedLessons.length > 0 && (
                  <motion.div
                    key="pinned-section"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                    className="flex flex-col gap-3"
                  >

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
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>

                {/* General module lessons */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-4">
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
                      <div className="p-6 text-center bg-slate-50 dark:bg-surface-low rounded-2xl border border-solid border-slate-200/50 dark:border-white/5 opacity-60">
                        <p className="text-[10px] font-black text-slate-500 dark:text-ink-muted uppercase tracking-wider">All lessons pinned above</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
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
