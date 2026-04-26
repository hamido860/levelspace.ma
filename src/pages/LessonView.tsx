import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Layout } from '../components/Layout';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ShieldAlert,
  Brain,
  Sparkles,
  X,
  Plus,
  Bell,
  StickyNote,
  Check,
  Edit2,
  Save,
  Trash2,
  BookOpen,
  HelpCircle,
  XCircle,
  PenTool,
  Lightbulb,
  Send,
  Target,
  Dumbbell,
  Type,
  Globe,
  ListMusic,
  List,
  FileText,
  FlaskConical,
  GraduationCap,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from '../db/supabase';
import { db } from '../db/db';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { toast } from 'sonner';
import {
  auditLessonLanguage,
  AuditResult,
  explainText,
  generateLessonTags,
  generateInteractiveContent,
  generateAnotherExample,
  checkAIProvider
} from '../services/geminiService';
import { getQuizzesByLesson } from '../services/quizService';
import { getExercisesByLesson } from '../services/exerciseService';
import { TagsManager } from '../components/TagsManager';
import { Modal } from '../components/Modal';
import { PedagogicalTools } from '../components/PedagogicalTools';
import { AIAssistant } from '../components/AIAssistant';
import { EduWorkspace } from '../components/workspace/EduWorkspace';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { indexLessonContent } from '../services/ragService';

const BLOCK_TYPE_CONFIG: Record<string, { icon: React.ElementType; colorClass: string; label: string }> = {
  // New canonical types
  intro:    { icon: BookOpen,      colorClass: 'text-accent',   label: 'Introduction' },
  theory:   { icon: FileText,      colorClass: 'text-accent',   label: 'Theory'       },
  formula:  { icon: Type,          colorClass: 'text-warning',  label: 'Formula'      },
  example:  { icon: FlaskConical,  colorClass: 'text-warning',  label: 'Example'      },
  exercise: { icon: Dumbbell,      colorClass: 'text-success',  label: 'Exercise'     },
  quiz:     { icon: HelpCircle,    colorClass: 'text-accent',   label: 'Quiz'         },
  exam:     { icon: GraduationCap, colorClass: 'text-warning',  label: 'Exam'         },
  summary:  { icon: List,          colorClass: 'text-success',  label: 'Summary'      },
  // Legacy fallback types
  definition: { icon: BookOpen,    colorClass: 'text-accent',   label: 'Definition'   },
  content:    { icon: FileText,    colorClass: 'text-accent',   label: 'Content'      },
  rules:      { icon: List,        colorClass: 'text-success',  label: 'Key Rules'    },
  examples:   { icon: FlaskConical,colorClass: 'text-warning',  label: 'Examples'     },
};

const getBlockTypeConfig = (type: string) =>
  BLOCK_TYPE_CONFIG[type] ?? { icon: FileText, colorClass: 'text-muted', label: 'Content' };

const isRTL = (text: string) => {
  const rtlChars = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return rtlChars.test(text);
};

const Timer = () => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isRunning) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime + 1);
      }, 1000);
    } else if (!isRunning) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 bg-surface-mid px-4 py-2 rounded-xl">
      <div className="font-mono font-bold text-lg text-ink">{formatTime(time)}</div>
      <button 
        onClick={() => setIsRunning(!isRunning)}
        className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${isRunning ? 'bg-warning-soft text-warning hover:bg-warning/20' : 'bg-success-soft text-success hover:bg-success/20'}`}
      >
        {isRunning ? 'Pause' : 'Start'}
      </button>
      <button 
        onClick={() => { setIsRunning(false); setTime(0); }}
        className="px-3 py-1 bg-error-soft text-error rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-error/20 transition-colors"
      >
        Reset
      </button>
    </div>
  );
};

const PENDING_STAGES = [
  'Analyzing curriculum...',
  'Building generation plan...',
  'Generating lesson content...',
  'Validating and saving...',
];

// Shown when AI Crew is generating a lesson on-demand (status === 'pending')
const PendingLessonView: React.FC<{ title: string; lessonId: string; onReady: () => void }> = ({ title, lessonId, onReady }) => {
  const navigate = useNavigate();
  const [dots, setDots] = useState('.');
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    const dotInterval  = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 600);
    const stageInterval = setInterval(() => setStageIdx(i => Math.min(i + 1, PENDING_STAGES.length - 1)), 8000);

    const handleReady = () => {
      clearInterval(dotInterval);
      clearInterval(stageInterval);
      db.lessons.update(lessonId, { status: 'done' }).then(onReady);
    };

    window.addEventListener('lesson-ready', handleReady);
    return () => {
      clearInterval(dotInterval);
      clearInterval(stageInterval);
      window.removeEventListener('lesson-ready', handleReady);
    };
  }, [lessonId, onReady]);

  return (
    <Layout fullWidth>
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 px-4">
        <div className="relative">
          <Loader2 className="w-12 h-12 text-accent animate-spin" />
          <Sparkles className="w-5 h-5 text-warning absolute -top-1 -right-1 animate-pulse" />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <p className="text-ink font-semibold text-lg">"{title}"</p>
          <p className="text-accent font-medium text-sm">{PENDING_STAGES[stageIdx]}{dots}</p>
          <p className="text-muted text-xs">AI Crew is building this lesson. This usually takes 30–90 seconds.</p>
        </div>
        <div className="flex gap-1.5">
          {PENDING_STAGES.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i <= stageIdx ? 'w-8 bg-accent' : 'w-3 bg-ink/10'}`} />
          ))}
        </div>
        <button onClick={() => navigate('/dashboard')} className="text-muted text-xs hover:text-accent transition-colors">
          Go back — lesson will be ready when you return
        </button>
      </div>
    </Layout>
  );
};

export const LessonView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user, isAdmin } = useAuth();
  const { settings } = useAppSettings();
  const askAiAccess = settings.ask_ai_access || 'admin';
  const hasAiAccess = askAiAccess === 'all' || (askAiAccess === 'admin' && isAdmin);
  const aiAvailable = checkAIProvider();

  const [openBlocks, setOpenBlocks] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'content' | 'quizzes' | 'exercises'>('content');
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [isLoadingExtra, setIsLoadingExtra] = useState(false);

  // Quiz state
  const [quizAnswered, setQuizAnswered] = useState<Record<number, boolean>>({});
  const [quizCorrect, setQuizCorrect] = useState<Record<number, boolean>>({});
  const [quizSelectedOption, setQuizSelectedOption] = useState<Record<number, string>>({});
  const [xp, setXp] = useState(35);

  // Exam state
  const [examInput, setExamInput] = useState<Record<number, string>>({});
  const [examHintShown, setExamHintShown] = useState<Record<number, boolean>>({});
  const [examResult, setExamResult] = useState<Record<number, 'correct' | 'wrong' | 'shown' | null>>({});

  // Exercise state
  const [exerciseHintShown, setExerciseHintShown] = useState<Record<number, boolean>>({});
  const [exerciseResult, setExerciseResult] = useState<Record<number, 'correct' | 'wrong' | 'shown' | null>>({});

  // Audit state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);

  // Scroll Progress state
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [noteContent, setNoteContent] = useState('');
  
  // Edit state
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');

  // Interactive Learning state
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [showInteractiveModal, setShowInteractiveModal] = useState(false);
  const [interactiveContent, setInteractiveContent] = useState<string | null>(null);
  const [isGeneratingInteractive, setIsGeneratingInteractive] = useState(false);
  const [activeInteractiveType, setActiveInteractiveType] = useState<'hard_questions' | 'more_examples' | 'exam_questions' | null>(null);
  const [showOutlineModal, setShowOutlineModal] = useState(false);
  const [readingBlockIndex, setReadingBlockIndex] = useState<number | null>(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [forceDir, setForceDir] = useState<'ltr' | 'rtl' | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / totalHeight) * 100;
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // AI Explanation state
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);


  // --- Audio Reading Logic ---
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleReadAloud = (index: number, text: string) => {
    if (!('speechSynthesis' in window)) {
      toast.error('Text-to-speech is not supported in this browser.');
      return;
    }

    if (readingBlockIndex === index) {
      // Stop reading
      window.speechSynthesis.cancel();
      setReadingBlockIndex(null);
    } else {
      // Start reading new block
      window.speechSynthesis.cancel();

      // Strip markdown syntax for better reading
      const cleanText = text
        .replace(/[#*_\`]/g, '')
        .replace(/\n/g, ' ')
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.9; // Slightly slower for better comprehension

      utterance.onend = () => {
        setReadingBlockIndex(null);
      };

      utterance.onerror = () => {
        setReadingBlockIndex(null);
        toast.error('Error playing audio.');
      };

      setReadingBlockIndex(index);
      window.speechSynthesis.speak(utterance);
    }
  };
  // -------------------------


  const handleMouseUp = (e: React.MouseEvent) => {
    // If we're clicking inside the explain button, don't do anything
    if ((e.target as HTMLElement).closest('.explain-btn')) return;

    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      setSelectedText(selection.toString().trim());
    } else {
      if (!explanation && !isExplaining) {
        setSelectedText(null);
      }
    }
  };

  const handleExplain = async () => {
    if (!selectedText || !lesson || !hasAiAccess || !aiAvailable) return;
    setIsExplaining(true);
    setExplanation(null);
    try {
      const context = effectiveLesson.blocks?.map(b => b.content || '').join('\n') || effectiveLesson.content || '';
      const result = await explainText(selectedText, context, selectedGrade, selectedCountry, language, module?.strictRAG);
      setExplanation(result);
    } catch (error) {
      console.error("Failed to explain text:", error);
      setExplanation("Failed to generate explanation. Please try again.");
    } finally {
      setIsExplaining(false);
    }
  };

  const lesson = useLiveQuery(() => id ? db.lessons.get(id) : undefined, [id]);
  const [supabaseLesson, setSupabaseLesson] = useState<any>(null);

  useEffect(() => {
    // If not found in IndexedDB, try Supabase by topic_id
    if (lesson === undefined && id) {
      supabase
        .from('lessons')
        .select('*')
        .eq('topic_id', id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setSupabaseLesson(data);
        });
    }
  }, [lesson, id]);

  // Merge: prefer IndexedDB lesson, fall back to Supabase
  const effectiveLesson = lesson || (supabaseLesson ? {
    id: supabaseLesson.id,
    moduleId: supabaseLesson.topic_id,
    title: supabaseLesson.lesson_title,
    content: supabaseLesson.content,
    status: 'done' as const,
    createdAt: Date.now(),
    blocks: supabaseLesson.blocks || [],
    subtitle: supabaseLesson.subtitle,
    tags: supabaseLesson.tags,
  } : undefined);

  const contentDir = useMemo(() => {
    if (forceDir) return forceDir;
    if (!effectiveLesson) return language === 'ar' ? 'rtl' : 'ltr';
    
    // Check title and first block for RTL characters
    const sampleText = (effectiveLesson.title || '') + (effectiveLesson.blocks?.[0]?.content || '');
    return isRTL(sampleText) ? 'rtl' : 'ltr';
  }, [lesson, language, forceDir]);

  const isMismatchedDir = useMemo(() => {
    const uiDir = language === 'ar' ? 'rtl' : 'ltr';
    return contentDir !== uiDir;
  }, [contentDir, language]);
  const module = useLiveQuery(() => effectiveLesson?.moduleId ? db.modules.get(effectiveLesson.moduleId) : undefined, [effectiveLesson?.moduleId]);
  const notes = useLiveQuery(() => id ? db.notes.where('lessonId').equals(id).toArray() : [], [id]) || [];
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const settingsMap = Object.fromEntries(dbSettings.map(s => [s.key, s.value]));

  const selectedGrade = settingsMap['selected_grade'] || localStorage.getItem('selected_grade') || 'Grade 12';
  const selectedCountry = settingsMap['selected_country'] || localStorage.getItem('selected_country') || '';

  // Initialize first block open
  useEffect(() => {
    if (effectiveLesson?.blocks && effectiveLesson.blocks.length > 0 && openBlocks.length === 0) {
      setOpenBlocks(['block-0']);
    } else if (effectiveLesson && !effectiveLesson.blocks && openBlocks.length === 0) {
      setOpenBlocks(['content']);
    }

    if (lesson) {
      // Save last viewed lesson
      db.settings.put({ key: 'last_viewed_lesson_id', value: effectiveLesson.id });
    }
  }, [lesson]);

  useEffect(() => {
    const fetchExtraData = async () => {
      if (!id) return;
      setIsLoadingExtra(true);
      try {
        const lessonQuizzes = await getQuizzesByLesson(id);
        const lessonExercises = await getExercisesByLesson(id);
        setQuizzes(lessonQuizzes || []);
        setExercises(lessonExercises || []);
      } catch (error) {
        console.error("Failed to fetch extra data:", error);
      } finally {
        setIsLoadingExtra(false);
      }
    };
    
    if (activeTab !== 'content') {
      fetchExtraData();
    }
  }, [activeTab, id]);

  const toggleBlock = (blockId: string) => {
    setOpenBlocks(prev => 
      prev.includes(blockId) 
        ? prev.filter(b => b !== blockId) 
        : [...prev, blockId]
    );
  };

  const markLessonComplete = async () => {
    if (lesson) {
      await db.lessons.update(effectiveLesson.id, { status: 'done' });
      
      // Index lesson content for RAG if user is logged in
      if (user) {
        try {
          const content = effectiveLesson.blocks?.map(b => b.content || '').join('\n') || effectiveLesson.content || '';
          await indexLessonContent(
            user.id,
            effectiveLesson.id,
            `${effectiveLesson.title}\n\n${content}`
          );
          console.log('Lesson content indexed for RAG');
        } catch (error) {
          console.error('Failed to index lesson content:', error);
        }
      }
      
      navigate('/dashboard');
    }
  };

  const handleQuizAnswer = (blockIndex: number, option: string, correctAnswer: string) => {
    if (quizAnswered[blockIndex]) return;
    
    const isCorrect = option === correctAnswer;
    setQuizSelectedOption(prev => ({ ...prev, [blockIndex]: option }));
    setQuizAnswered(prev => ({ ...prev, [blockIndex]: true }));
    setQuizCorrect(prev => ({ ...prev, [blockIndex]: isCorrect }));
    
    if (isCorrect) {
      setXp(prev => Math.min(100, prev + 15));
    }
  };

  const handleExamSubmit = (blockIndex: number, solution: string) => {
    // For paper-based exercises, we just show the solution
    setExamResult(prev => ({ ...prev, [blockIndex]: 'shown' }));
  };

  const handleExerciseSubmit = (blockIndex: number, solution: string) => {
    setExerciseResult(prev => ({ ...prev, [blockIndex]: 'shown' }));
  };

  const handleAudit = async () => {
    if (!effectiveLesson || !module || !hasAiAccess || !aiAvailable) return;
    setIsAuditing(true);
    setAuditResult(null);
    try {
      const result = await auditLessonLanguage(
        effectiveLesson.title,
        effectiveLesson.blocks || [{ content: effectiveLesson.content }],
        module.name,
        selectedGrade,
        selectedCountry
      );
      setAuditResult(result);
    } catch (error) {
      console.error("Audit failed", error);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleGenerateTags = async () => {
    if (!effectiveLesson || !hasAiAccess || !aiAvailable) return;
    setIsGeneratingTags(true);
    try {
      const content = effectiveLesson.blocks?.map(b => b.content || '').join('\n') || effectiveLesson.content || '';
      const newTags = await generateLessonTags(effectiveLesson.title, content, selectedGrade, selectedCountry);
      if (newTags.length > 0) {
        const currentTags = effectiveLesson.tags || [];
        const combined = Array.from(new Set([...currentTags, ...newTags]));
        await db.lessons.update(effectiveLesson.id, { tags: combined });
      }
    } catch (error) {
      console.error("Failed to generate tags", error);
    } finally {
      setIsGeneratingTags(false);
    }
  };

  const handleAddReminder = async () => {
    if (!reminderText) return;
    await db.tasks.add({
      id: crypto.randomUUID(),
      title: reminderText,
      completed: false,
      createdAt: Date.now(),
      dueDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      type: 'general'
    });
    setReminderText('');
    setShowReminderModal(false);
  };

  const handleAddNote = async () => {
    if (!noteContent || !lesson) return;
    await db.notes.add({
      id: crypto.randomUUID(),
      lessonId: effectiveLesson.id,
      content: noteContent,
      createdAt: Date.now()
    });
    setNoteContent('');
    setShowNoteModal(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    await db.notes.delete(noteId);
  };

  const startEditing = (index: number, block: any) => {
    setEditingBlockIndex(index);
    setEditTitle(block.title);
    setEditContent(block.content || '');
  };

  const saveEdit = async () => {
    if (!effectiveLesson || editingBlockIndex === null) return;
    const newBlocks = [...(effectiveLesson.blocks || [])];
    newBlocks[editingBlockIndex] = {
      ...newBlocks[editingBlockIndex],
      title: editTitle,
      content: editContent
    };
    await db.lessons.update(effectiveLesson.id, { blocks: newBlocks });
    setEditingBlockIndex(null);
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    // Only trigger if clicking directly on the container or white space
    if (e.target !== e.currentTarget) return;

    const now = Date.now();
    if (now - lastClickTime > 500) {
      setClickCount(1);
    } else {
      const newCount = clickCount + 1;
      setClickCount(newCount);
      if (newCount === 3) {
        setShowInteractiveModal(true);
        setClickCount(0);
      }
    }
    setLastClickTime(now);
  };

  const handleGenerateInteractive = async (type: 'hard_questions' | 'more_examples' | 'exam_questions') => {
    if (!effectiveLesson || !hasAiAccess || !aiAvailable) return;
    setIsGeneratingInteractive(true);
    setActiveInteractiveType(type);
    setInteractiveContent(null);
    try {
      const content = effectiveLesson.blocks?.map((b: any) => b.content || '').join('\n') || effectiveLesson.content || '';
      const result = await generateInteractiveContent(type, content, selectedGrade, selectedCountry, module?.strictRAG);
      setInteractiveContent(result);
    } catch (error) {
      console.error("Failed to generate interactive content:", error);
      setInteractiveContent("Failed to generate content. Please try again.");
    } finally {
      setIsGeneratingInteractive(false);
    }
  };

  const [isGeneratingExample, setIsGeneratingExample] = useState<number | null>(null);

  const handleGenerateAnotherExample = async (blockIndex: number) => {
    if (!effectiveLesson || !effectiveLesson.blocks) return;
    const block = effectiveLesson.blocks[blockIndex];
    if (!block || block.type !== 'examples' || !block.examples) return;

    setIsGeneratingExample(blockIndex);
    try {
      const newExample = await generateAnotherExample(
        effectiveLesson.title,
        block.title || 'Examples',
        block.examples,
        selectedGrade,
        selectedCountry,
        module?.strictRAG
      );

      if (newExample) {
        const newBlocks = [...effectiveLesson.blocks];
        newBlocks[blockIndex] = {
          ...block,
          examples: [...block.examples, newExample]
        };
        await db.lessons.update(effectiveLesson.id, { blocks: newBlocks });
        toast.success("New example generated!");
      } else {
        toast.error("Failed to generate a new example.");
      }
    } catch (error) {
      console.error("Error generating example:", error);
      toast.error("An error occurred while generating the example.");
    } finally {
      setIsGeneratingExample(null);
    }
  };

  if (effectiveLesson === undefined) {
    return (
      <Layout fullWidth>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      </Layout>
    );
  }

  if (effectiveLesson === null) {
    return (
      <Layout fullWidth>
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <AlertCircle className="w-12 h-12 text-error" />
          <p className="text-ink font-medium">Lesson not found.</p>
          <button onClick={() => navigate('/dashboard')} className="text-accent hover:underline">Return to Dashboard</button>
        </div>
      </Layout>
    );
  }

  // AI Crew is generating this lesson on-demand (Pro planned, Gemma 4 is executing)
  if (effectiveLesson.status === 'pending') {
    return (
      <PendingLessonView
        title={effectiveLesson.title}
        lessonId={id!}
        onReady={() => window.location.reload()}
      />
    );
  }

  const blocks = effectiveLesson.blocks || [];
  const totalBlocks = blocks.length > 0 ? blocks.length : 1;
  const openCount = openBlocks.length;
  const progressPct = Math.round((openCount / totalBlocks) * 100);

  return (
    <Layout fullWidth>
      {/* Fixed Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1.5 z-40 bg-ink/5 pointer-events-none">
        <motion.div 
          className="h-full bg-accent shadow-[0_0_12px_rgba(18,70,255,0.4)]"
          initial={{ width: 0 }}
          animate={{ width: `${scrollProgress}%` }}
          transition={{ type: 'spring', damping: 25, stiffness: 120 }}
        />
      </div>

      <div 
        className="max-w-7xl mx-auto py-6 px-4 pb-24 min-h-screen relative" 
        dir={contentDir}
        onMouseUp={handleMouseUp}
        onClick={handleBackgroundClick}
      >
        {isMismatchedDir && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-6 right-4 z-30"
          >
            <button
              onClick={() => setForceDir(contentDir === 'rtl' ? 'ltr' : 'rtl')}
              className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-accent hover:text-white transition-all shadow-sm backdrop-blur-sm"
              title="Switch Content Direction"
            >
              <Globe size={12} />
              {contentDir === 'rtl' ? 'RTL View' : 'LTR View'}
            </button>
          </motion.div>
        )}
        <AnimatePresence>
          {clickCount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="fixed top-20 right-8 z-50 bg-accent text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg pointer-events-none"
            >
              {clickCount}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedText && !explanation && !isExplaining && hasAiAccess && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-4 w-full max-w-md"
            >
              <div className="bg-ink text-paper p-3 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-white/10">
                <div className="flex-1 truncate text-xs text-paper/70 italic">
                  "{selectedText.length > 40 ? selectedText.substring(0, 40) + '...' : selectedText}"
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (aiAvailable) handleExplain();
                  }}
                  disabled={!aiAvailable}
                  title={!aiAvailable ? "AI help requires API key" : undefined}
                  className="explain-btn shrink-0 bg-accent text-paper px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent"
                >
                  <Brain size={14} />
                  Explain
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Modal
          isOpen={isExplaining || !!explanation}
          onClose={() => {
            if (!isExplaining) {
              setExplanation(null);
              setSelectedText(null);
            }
          }}
          maxWidth="4xl"
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent shadow-sm">
                <Brain size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-ink">AI Contextual Explanation</h3>
                <p className="text-[10px] text-muted font-medium">Grounded in this lesson's content</p>
              </div>
            </div>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-4">
              <div className="p-4 bg-surface-low rounded-2xl border border-ink/5 space-y-3">
                <div className="flex items-center gap-2 text-accent">
                  <Sparkles size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Source Context</span>
                </div>
                <p className="text-sm font-medium text-ink italic leading-relaxed border-l-2 border-accent/30 pl-4 py-1">
                  "{selectedText}"
                </p>
              </div>
              <div className="p-4 bg-accent/5 rounded-2xl border border-accent/10">
                <p className="text-[10px] text-accent font-medium leading-relaxed">
                  The AI analyzes this specific snippet within the context of the entire lesson to provide the most relevant explanation.
                </p>
              </div>
            </div>
            
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted">
                  <BookOpen size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">AI Analysis</span>
                </div>
                {!isExplaining && (
                  <span className="text-[9px] font-mono text-muted/40 uppercase">v3.1-FLASH-LITE</span>
                )}
              </div>
              <div className="bg-paper p-6 rounded-2xl border border-ink/5 shadow-sm min-h-[200px]">
                <div className="text-sm text-ink leading-relaxed prose prose-sm max-w-none">
                  {isExplaining ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <Loader2 size={32} className="animate-spin text-accent" />
                      <div className="space-y-1 text-center">
                        <p className="text-xs font-bold text-ink">Synthesizing Explanation...</p>
                        <p className="text-[10px] text-muted italic">Connecting concepts and examples</p>
                      </div>
                    </div>
                  ) : (
                    <div className="markdown-body">
                      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{explanation || ''}</Markdown>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {!isExplaining && (
            <div className="mt-8 pt-6 border-t border-ink/5 flex justify-end">
              <button 
                onClick={() => {
                  setExplanation(null);
                  setSelectedText(null);
                }}
                className="px-8 py-2.5 bg-ink text-paper rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all shadow-lg shadow-ink/10"
              >
                Understood
              </button>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={showInteractiveModal}
          dir={contentDir}
          onClose={() => {
            setShowInteractiveModal(false);
            setInteractiveContent(null);
            setActiveInteractiveType(null);
          }}
          maxWidth="3xl"
          title={
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent shadow-sm">
                <Sparkles size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-ink">{t('interactive_title')}</h3>
                <p className="text-[10px] text-muted font-medium">{t('interactive_desc')}</p>
              </div>
            </div>
          }
        >
          <div className="space-y-8">
            {!interactiveContent && !isGeneratingInteractive ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { 
                    id: 'hard_questions', 
                    title: t('hard_questions'), 
                    desc: 'Deep dive into complex concepts', 
                    icon: <Brain className="w-6 h-6 text-purple-500" />,
                    bg: 'bg-purple-500/5',
                    border: 'border-purple-500/10'
                  },
                  { 
                    id: 'more_examples', 
                    title: t('more_examples'), 
                    desc: 'See more practical applications', 
                    icon: <Lightbulb className="w-6 h-6 text-amber-500" />,
                    bg: 'bg-amber-500/5',
                    border: 'border-amber-500/10'
                  },
                  { 
                    id: 'exam_questions', 
                    title: t('exam_questions'), 
                    desc: 'Prepare for national standards', 
                    icon: <PenTool className="w-6 h-6 text-emerald-500" />,
                    bg: 'bg-emerald-500/5',
                    border: 'border-emerald-500/10'
                  }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleGenerateInteractive(item.id as any)}
                    className={`group flex flex-col items-start gap-4 p-6 ${item.bg} border ${item.border} rounded-2xl hover:border-accent/40 hover:shadow-lg transition-all text-left relative overflow-hidden`}
                  >
                    <div className="p-3 bg-paper rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                      {item.icon}
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-ink group-hover:text-accent transition-colors">{item.title}</h4>
                      <p className="text-[10px] text-muted leading-relaxed">{item.desc}</p>
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      activeInteractiveType === 'hard_questions' ? 'bg-purple-500' : 
                      activeInteractiveType === 'more_examples' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                    <span className="text-[10px] font-bold text-ink uppercase tracking-widest">
                      {activeInteractiveType === 'hard_questions' ? t('hard_questions') : 
                       activeInteractiveType === 'more_examples' ? t('more_examples') : t('exam_questions')}
                    </span>
                  </div>
                  {interactiveContent && (
                    <button 
                      onClick={() => {
                        setInteractiveContent(null);
                        setActiveInteractiveType(null);
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-accent uppercase tracking-widest hover:underline"
                    >
                      <X size={12} />
                      {t('back')}
                    </button>
                  )}
                </div>
                
                <div className="bg-surface-low p-8 rounded-3xl border border-ink/5 min-h-[300px] relative">
                  {isGeneratingInteractive ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                      <Loader2 size={32} className="animate-spin text-accent" />
                      <div className="text-center space-y-1">
                        <p className="text-xs font-bold text-ink">Generating Insights...</p>
                        <p className="text-[10px] text-muted italic">Gemini is crafting custom materials for you</p>
                      </div>
                    </div>
                  ) : (
                    <div className="markdown-body prose prose-sm max-w-none">
                      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>
                        {interactiveContent || ''}
                      </Markdown>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal>

        <div className="max-w-4xl mx-auto">
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          {/* Lesson Header */}
          <header className="lesson-header">
          <div className="lesson-header__meta">
            <span className="pill pill--info">{selectedGrade}</span>
            {module && <span className="pill pill--neutral">{module.name}</span>}
            <span className="pill pill--success">saved</span>
            <span className="pill pill--warn">medium</span>
          </div>

          <h1 className="lesson-header__title">
            {effectiveLesson.title}
          </h1>

          <p className="lesson-header__sub">
            {effectiveLesson.subtitle || `${totalBlocks} blocks · ~15 min · AI Generated`}
          </p>

          <div className="mt-4 mb-6 flex items-center gap-4">
            <div className="flex-grow">
              <TagsManager 
                tags={effectiveLesson.tags || []}
                onAddTag={async (tag) => {
                  const currentTags = effectiveLesson.tags || [];
                  if (!currentTags.includes(tag)) {
                    await db.lessons.update(effectiveLesson.id, { tags: [...currentTags, tag] });
                  }
                }}
                onRemoveTag={async (tag) => {
                  const currentTags = effectiveLesson.tags || [];
                  await db.lessons.update(effectiveLesson.id, { tags: currentTags.filter(t => t !== tag) });
                }}
                maxDisplay={7}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsWorkspaceOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-ink transition-all shadow-lg shadow-accent/20"
              >
                <Sparkles className="w-3 h-3" />
                Workspace
              </button>
              <button
                onClick={handleGenerateTags}
                disabled={isGeneratingTags || !hasAiAccess || !aiAvailable}
                title={!aiAvailable ? "AI features need an API key — configure one in Settings to enable." : ""}
                className="flex items-center gap-2 px-3 py-1.5 bg-accent/5 text-accent rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-accent/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingTags ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {isGeneratingTags ? 'Generating...' : 'Auto Tags'}
              </button>
            </div>
          </div>

          <div className="progress">
            <div className="progress__label">
              <span>Progress</span>
              <span>{openCount} / {totalBlocks} blocks</span>
            </div>
            <div className="progress__track">
              <div className="progress__fill" style={{ width: `${progressPct}%` }}></div>
            </div>
          </div>
        </header>

        {/* Config Strip */}
        <div className="config-strip mb-8">
          <div>
            <div className="config-strip__label">Config used</div>
            <div className="config-strip__name">
              {effectiveLesson.title} · {totalBlocks} blocks
            </div>
          </div>
          <div className="config-strip__author">
            <div className="avatar">AI</div>
            <span className="text-xs text-ink-secondary">LevelSpace AI</span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button 
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className="w-8 h-8 rounded-xl bg-ink text-paper flex items-center justify-center hover:bg-accent transition-colors"
                >
                  <Plus className={`w-4 h-4 transition-transform ${showAddMenu ? 'rotate-45' : ''}`} />
                </button>
                
                <AnimatePresence>
                  {showAddMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-48 bg-paper border border-ink/5 rounded-2xl shadow-2xl z-50 overflow-hidden"
                    >
                      <button 
                        onClick={() => {
                          setShowReminderModal(true);
                          setShowAddMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-muted hover:text-ink hover:bg-surface-low transition-all text-left"
                      >
                        <Bell className="w-4 h-4 text-accent" />
                        Add Reminder
                      </button>
                      <button 
                        onClick={() => {
                          setShowNoteModal(true);
                          setShowAddMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-muted hover:text-ink hover:bg-surface-low transition-all text-left"
                      >
                        <StickyNote className="w-4 h-4 text-emerald-500" />
                        Add Note
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-ink/10 mb-8">
          <button
            onClick={() => setActiveTab('content')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 ${
              activeTab === 'content' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Content
          </button>
          <button
            onClick={() => setActiveTab('quizzes')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'quizzes' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Quizzes
            {quizzes.length > 0 && <span className="bg-accent/10 text-accent px-1.5 py-0.5 rounded text-[10px]">{quizzes.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab('exercises')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-widest transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'exercises' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Exercises
            {exercises.length > 0 && <span className="bg-accent/10 text-accent px-1.5 py-0.5 rounded text-[10px]">{exercises.length}</span>}
          </button>
        </div>

        {/* Main Content Grid */}
        {activeTab === 'content' && (
          <>
          <div className="space-y-8">
            {/* Audit Result */}
            {auditResult && (
              <div className={`p-4 rounded-xl border ${auditResult.isAccurate ? 'bg-success-soft border-success text-success' : 'bg-warning-soft border-warning text-warning'}`}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    Language Audit: {auditResult.isAccurate ? 'Passed' : 'Failed'}
                  </h3>
                  <button onClick={() => setAuditResult(null)} className="text-xs opacity-70 hover:opacity-100">Dismiss</button>
                </div>
                <p className="text-xs mb-2 opacity-90">
                  <strong>Expected:</strong> {auditResult.expectedLanguage} <br/>
                  <strong>Detected:</strong> {auditResult.detectedLanguages.join(', ')}
                </p>
                <p className="text-xs opacity-90 leading-relaxed">{auditResult.feedback}</p>
              </div>
            )}

            {/* Lesson Blocks */}
            <div className="space-y-2">
              {blocks.length > 0 ? (
                blocks.map((block, index) => {
                  const blockId = `block-${index}`;
                  const isOpen = openBlocks.includes(blockId);
                  const { icon: BlockIcon, colorClass: blockColorClass } = getBlockTypeConfig(block.type || '');

              // Determine status
              let status = 'pending';
              if (isOpen) status = 'active';
              if (block.type === 'quiz' && quizAnswered[index]) {
                status = quizCorrect[index] ? 'done' : 'error';
              }
              if (block.type === 'exam' && examResult[index]) {
                status = examResult[index] === 'correct' ? 'done' : 'error';
              }

              return (
                <article key={index} className="block group">
                  <div
                    className={`block__header sticky top-16 z-20 backdrop-blur-xl bg-paper/90 border-b border-surface-mid transition-all duration-200 ${isOpen ? 'shadow-md' : 'shadow-sm'}`}
                    onClick={() => toggleBlock(blockId)}
                  >
                    <div className={`block__num block__num--${status}`}>
                      {status === 'done' ? '✓' : status === 'error' ? '!' : index + 1}
                    </div>
                    <BlockIcon size={14} className={`shrink-0 ${blockColorClass} opacity-70`} />
                    <span className="block__label">{block.title}</span>
                    <div className="flex items-center gap-2 ml-auto mr-2">
                      {block.type === 'quiz' && <span className="pill pill--warn text-[10px]">interactive</span>}
                      {block.type === 'exam' && <span className="pill pill--danger text-[10px]">national exam</span>}
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(index, block);
                        }}
                        className="w-8 h-8 rounded-xl hover:bg-ink/5 flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                    <ChevronRight className={`block__chevron ${isOpen ? 'block__chevron--open' : ''}`} />
                  </div>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="block__body block__body--open">
                      {editingBlockIndex === index ? (
                        <div className="space-y-4 p-4 bg-surface-low rounded-2xl border border-accent/20 mb-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Block Title</label>
                            <input 
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full p-3 bg-paper border border-ink/5 rounded-xl text-sm focus:outline-none focus:border-accent/30"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Content (Markdown)</label>
                            <textarea 
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={6}
                              className="w-full p-3 bg-paper border border-ink/5 rounded-xl text-sm focus:outline-none focus:border-accent/30 resize-none font-mono"
                            />
                          </div>
                          <div className="flex justify-end gap-3 pt-2">
                            <button 
                              onClick={() => setEditingBlockIndex(null)}
                              className="px-4 py-2 text-xs font-bold text-muted hover:text-ink transition-colors"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={saveEdit}
                              className="flex items-center gap-2 px-6 py-2 bg-accent text-paper rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ink transition-all shadow-lg shadow-accent/20"
                            >
                              <Save size={14} />
                              Save Changes
                            </button>
                          </div>
                        </div>
                      ) : null}
                      
                                            {/* Intro */}
                      {block.type === 'intro' && block.content && (
                        <div className="p-4 rounded-2xl bg-accent/5 border border-accent/15">
                          <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>
                            {block.content}
                          </Markdown>
                        </div>
                      )}

                      {/* Theory */}
                      {block.type === 'theory' && block.content && (
                        <div className="def-box">
                          <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-accent/15">
                            <FileText size={11} className="text-accent" />
                            <span className="text-[9px] font-bold text-accent uppercase tracking-widest">
                              {block.title || 'Theory'}
                            </span>
                          </div>
                          <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>
                            {block.content}
                          </Markdown>
                        </div>
                      )}

                      {/* Formula */}
                      {block.type === 'formula' && block.content && (
                        <div className="p-4 rounded-2xl bg-warning/5 border border-warning/20">
                          <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-warning/15">
                            <Type size={11} className="text-warning" />
                            <span className="text-[9px] font-bold text-warning uppercase tracking-widest">
                              {block.label || 'Formula'}
                            </span>
                          </div>
                          <div className="font-mono text-sm">
                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>
                              {block.content}
                            </Markdown>
                          </div>
                        </div>
                      )}

                      {/* Example */}
                      {block.type === 'example' && block.content && (
                        <div className="example-card">
                          <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-warning/15">
                            <FlaskConical size={11} className="text-warning" />
                            <span className="text-[9px] font-bold text-warning uppercase tracking-widest">
                              {block.title || 'Example'}
                            </span>
                          </div>
                          <div className="example-card__question">
                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>
                              {block.content}
                            </Markdown>
                          </div>
                        </div>
                      )}

                      {/* Summary */}
                      {block.type === 'summary' && block.points && Array.isArray(block.points) && (
                        <div className="p-4 rounded-2xl bg-success/5 border border-success/20">
                          <div className="flex items-center gap-1.5 mb-3 pb-2 border-b border-success/15">
                            <List size={11} className="text-success" />
                            <span className="text-[9px] font-bold text-success uppercase tracking-widest">Key Takeaways</span>
                          </div>
                          <ul className="rules-list">
                            {block.points.map((point: string, i: number) => (
                              <li key={i} className="rules-list__item">
                                <div className="rules-list__dot"></div>
                                <span>
                                  <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>
                                    {point}
                                  </Markdown>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Definition / Content */}
                          {(block.type === 'definition' || block.type === 'content') && block.content && (
                            <div className="def-box">
                              <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-accent/15">
                                <BookOpen size={11} className="text-accent" />
                                <span className="text-[9px] font-bold text-accent uppercase tracking-widest">
                                  {block.type === 'definition' ? 'Definition' : 'Content'}
                                </span>
                              </div>
                              <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{block.content}</Markdown>
                              {block.source && <span className="def-box__source">Source: {block.source}</span>}
                            </div>
                          )}

                          {/* Rules */}
                          {block.type === 'rules' && block.rules && Array.isArray(block.rules) && (
                            <>
                              <div className="flex items-center gap-1.5 mt-3.5 mb-1">
                                <List size={12} className="text-success" />
                                <span className="text-[9px] font-bold text-success uppercase tracking-widest">Key Rules</span>
                              </div>
                              <ul className="rules-list">
                                {block.rules.map((rule, i) => (
                                  <li key={i} className="rules-list__item">
                                    <div className="rules-list__dot"></div>
                                    <span><Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{rule}</Markdown></span>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}

                          {/* Examples */}
                          {block.type === 'examples' && block.examples && Array.isArray(block.examples) && (
                            <>
                              <div className="flex items-center gap-1.5 mt-3.5 mb-1">
                                <FlaskConical size={12} className="text-warning" />
                                <span className="text-[9px] font-bold text-warning uppercase tracking-widest">Worked Examples</span>
                              </div>
                              {block.examples.map((ex, i) => (
                                <div key={i} className="example-card">
                                  <div className="example-card__question"><Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{ex.question}</Markdown></div>
                                  {Array.isArray(ex.steps) && ex.steps.map((step, j) => (
                                    <div key={j} className="example-card__step"><Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{step}</Markdown></div>
                                  ))}
                                  <div className="example-card__answer"><Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{ex.answer}</Markdown></div>
                                </div>
                              ))}
                              <div className="action-row">
                                <button 
                                  className="btn-action"
                                  onClick={() => handleGenerateAnotherExample(index)}
                                  disabled={isGeneratingExample === index}
                                >
                                  {isGeneratingExample === index ? (
                                    <span className="flex items-center gap-2">
                                      <Loader2 size={14} className="animate-spin" />
                                      Generating...
                                    </span>
                                  ) : (
                                    "Generate another example ↗"
                                  )}
                                </button>
                              </div>
                            </>
                          )}

                          {/* Quiz — new canonical flat format */}
                          {block.type === 'quiz' && !block.quiz && block.question && Array.isArray(block.options) && (
                            <div className="bg-surface-low rounded-2xl p-4 mt-4 border border-ink/5">
                              <p className="font-bold text-sm mb-4 text-ink leading-relaxed"><Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{block.question}</Markdown></p>
                              <div className="grid gap-2">
                                {block.options.map((opt, i) => {
                                  const isSelected = quizAnswered[index] === opt;
                                  const isCorrect = opt === block.correctAnswer;
                                  const showResult = quizAnswered[index];

                                  let bgClass = "bg-paper border-surface-mid hover:border-accent hover:bg-accent/5";
                                  if (showResult) {
                                    if (isCorrect) bgClass = "bg-success/10 border-success text-success-dark";
                                    else if (isSelected) bgClass = "bg-error/10 border-error text-error-dark";
                                    else bgClass = "bg-paper border-surface-mid opacity-50";
                                  }

                                  return (
                                    <button
                                      key={i}
                                      onClick={() => handleQuizSubmit(index, opt, block.correctAnswer!)}
                                      disabled={!!showResult}
                                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${bgClass} flex items-center justify-between group`}
                                    >
                                      <span className="text-sm font-medium"><Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{opt}</Markdown></span>
                                      {showResult && isCorrect && <CheckCircle2 size={18} className="text-success" />}
                                      {showResult && isSelected && !isCorrect && <X size={18} className="text-error" />}
                                      {!showResult && <ChevronRight size={16} className="text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" />}
                                    </button>
                                  );
                                })}
                              </div>

                              <AnimatePresence>
                                {quizAnswered[index] && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                    animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                                    className={`p-4 rounded-xl border ${quizCorrect[index] ? 'bg-success/10 border-success/20 text-success-dark' : 'bg-surface-mid border-ink/10 text-ink'}`}
                                  >
                                    <div className="flex gap-3">
                                      <div className="mt-0.5">
                                        {quizCorrect[index] ? <CheckCircle2 size={18} className="text-success" /> : <Lightbulb size={18} className="text-warning" />}
                                      </div>
                                      <div>
                                        <p className="font-bold text-sm mb-1">
                                          {quizCorrect[index] ? 'Correct! +15 XP' : 'Not quite right'}
                                        </p>
                                        <p className="text-xs opacity-90 leading-relaxed">
                                          {quizCorrect[index] ? 'Great job! You nailed it.' : block.explanation}
                                        </p>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Quiz */}
                          {block.type === 'quiz' && block.quiz && Array.isArray(block.quiz.options) && (
                            <div className="bg-surface-low rounded-2xl p-5 mt-4 border border-ink/5">
                              <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                                  <HelpCircle size={16} />
                                </div>
                                <h4 className="font-bold text-ink">Knowledge Check</h4>
                              </div>
                              
                              <div className="text-sm font-medium text-ink mb-5 leading-relaxed">
                                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{block.quiz.question}</Markdown>
                              </div>
                              
                              <div className="flex flex-col gap-2">
                                {block.quiz.options.map((opt, i) => {
                                  const isAnswered = quizAnswered[index];
                                  const isSelected = quizSelectedOption[index] === opt;
                                  const isCorrectOption = opt === block.quiz?.correctAnswer;
                                  
                                  let btnClass = "relative w-full text-left p-4 rounded-xl border-2 transition-all duration-200 text-sm font-medium ";
                                  
                                  if (!isAnswered) {
                                    btnClass += "border-surface-mid bg-paper text-ink-secondary hover:border-accent/50 hover:bg-accent/5";
                                  } else {
                                    if (isCorrectOption) {
                                      btnClass += "border-success bg-success-soft text-success";
                                    } else if (isSelected && !isCorrectOption) {
                                      btnClass += "border-error bg-error-soft text-error";
                                    } else {
                                      btnClass += "border-surface-mid bg-paper/50 text-ink-muted opacity-50";
                                    }
                                  }
                                  
                                  return (
                                    <button 
                                      key={i} 
                                      className={btnClass}
                                      disabled={isAnswered}
                                      onClick={() => handleQuizAnswer(index, opt, block.quiz!.correctAnswer)}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span>{opt}</span>
                                        {isAnswered && isCorrectOption && <CheckCircle2 className="w-5 h-5 text-success" />}
                                        {isAnswered && isSelected && !isCorrectOption && <XCircle className="w-5 h-5 text-error" />}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                              
                              <AnimatePresence>
                                {quizAnswered[index] && (
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                    animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                                    className={`p-4 rounded-xl ${quizCorrect[index] ? 'bg-success-soft text-success' : 'bg-error-soft text-error'}`}
                                  >
                                    <div className="flex items-start gap-3">
                                      {quizCorrect[index] ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                                      <div>
                                        <p className="font-bold text-sm mb-1">
                                          {quizCorrect[index] ? 'Correct! +15 XP' : 'Not quite right'}
                                        </p>
                                        <p className="text-xs opacity-90 leading-relaxed">
                                          {quizCorrect[index] ? 'Great job! You nailed it.' : block.quiz.explanation}
                                        </p>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Exercise — new canonical format */}
                          {block.type === 'exercise' && !block.exercise && block.content && (
                            <div className="bg-surface-low rounded-2xl p-5 mt-4 border border-ink/5">
                              <div className="text-sm font-medium text-ink mb-4 leading-relaxed">
                                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{block.content}</Markdown>
                              </div>
                              {!exerciseResult[index] ? (
                                <div className="flex gap-3">
                                  {block.hint && (
                                    <button
                                      className="flex-1 py-3 bg-paper border-2 border-surface-mid text-ink-secondary rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-surface-mid transition-colors flex items-center justify-center gap-2"
                                      onClick={() => setExerciseHintShown(prev => ({ ...prev, [index]: true }))}
                                      disabled={exerciseHintShown[index]}
                                    >
                                      <Lightbulb size={16} />
                                      {exerciseHintShown[index] ? block.hint : 'Show Hint'}
                                    </button>
                                  )}
                                  <button
                                    className="flex-[2] py-3 bg-accent text-paper rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                                    onClick={() => handleExerciseSubmit(index, block.solution || '')}
                                  >
                                    <CheckCircle2 size={16} />
                                    I'm Done, Show Solution
                                  </button>
                                </div>
                              ) : (
                                <div className="p-4 rounded-xl bg-surface-low border border-surface-mid">
                                  <p className="font-bold text-sm mb-1 text-ink">Solution</p>
                                  <div className="text-xs leading-relaxed mt-2 pt-2 border-t border-current/10 text-ink">
                                    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{block.solution || ''}</Markdown>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Exercise */}
                          {block.type === 'exercise' && block.exercise && (
                            <div className="bg-surface-low rounded-2xl p-5 mt-4 border border-ink/5">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                                    <Dumbbell size={16} />
                                  </div>
                                  <h4 className="font-bold text-ink">Practice Exercise</h4>
                                </div>
                                <Timer />
                              </div>
                              
                              <div className="text-sm font-medium text-ink mb-5 leading-relaxed">
                                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{block.exercise.question}</Markdown>
                              </div>
                              
                              <div className="mb-4 p-4 bg-paper border-2 border-surface-mid rounded-xl text-sm text-ink-secondary flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-surface-low flex items-center justify-center shrink-0">
                                  <PenTool size={20} className="text-ink-muted" />
                                </div>
                                <div>
                                  <p className="font-bold text-ink">Grab a pen and paper!</p>
                                  <p className="text-xs">Solve this exercise on paper. When you are finished, check the solution below.</p>
                                </div>
                              </div>
                              
                              <AnimatePresence>
                                {exerciseHintShown[index] && (
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mb-4 p-4 bg-warning-soft rounded-xl border border-warning/20 text-warning text-sm"
                                  >
                                    <div className="flex gap-2">
                                      <Lightbulb className="w-5 h-5 shrink-0" />
                                      <p><span className="font-bold">Hint:</span> {block.exercise.hint}</p>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {!exerciseResult[index] ? (
                                <div className="flex gap-3">
                                  <button 
                                    className="flex-1 py-3 bg-paper border-2 border-surface-mid text-ink-secondary rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-surface-mid transition-colors flex items-center justify-center gap-2" 
                                    onClick={() => setExerciseHintShown(prev => ({ ...prev, [index]: true }))}
                                    disabled={exerciseHintShown[index]}
                                  >
                                    <Lightbulb size={16} />
                                    {exerciseHintShown[index] ? 'Hint Shown' : 'Show Hint'}
                                  </button>
                                  <button 
                                    className="flex-[2] py-3 bg-accent text-paper rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2" 
                                    onClick={() => handleExerciseSubmit(index, block.exercise!.solution)}
                                  >
                                    <CheckCircle2 size={16} />
                                    I'm Done, Show Solution
                                  </button>
                                </div>
                              ) : (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="p-4 rounded-xl bg-surface-low border border-surface-mid"
                                >
                                  <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-success" />
                                    <div className="w-full">
                                      <p className="font-bold text-sm mb-1 text-ink">
                                        Solution
                                      </p>
                                      <div className="text-xs opacity-90 leading-relaxed mt-2 pt-2 border-t border-current/10 text-ink">
                                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{block.exercise.solution}</Markdown>
                                      </div>
                                      
                                      <div className="mt-4 pt-4 border-t border-surface-mid flex items-center justify-between">
                                        <p className="text-xs font-bold text-ink-secondary">Did you get it right?</p>
                                        <div className="flex gap-2">
                                          <button 
                                            onClick={() => setXp(prev => Math.min(100, prev + 15))}
                                            className="px-3 py-1.5 bg-success-soft text-success rounded-lg text-xs font-bold hover:bg-success/20 transition-colors"
                                          >
                                            Yes (+15 XP)
                                          </button>
                                          <button 
                                            className="px-3 py-1.5 bg-error-soft text-error rounded-lg text-xs font-bold hover:bg-error/20 transition-colors"
                                          >
                                            No, I need to review
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          )}

                          {/* Exam */}
                          {block.type === 'exam' && block.exam && (
                            <div className="bg-surface-low rounded-2xl p-5 mt-4 border border-ink/5">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center text-warning">
                                    <PenTool size={16} />
                                  </div>
                                  <h4 className="font-bold text-ink">National Exam Training</h4>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Timer />
                                  {block.exam.source && (
                                    <span className="text-[10px] font-bold text-warning uppercase tracking-widest px-2 py-1 bg-warning/10 rounded-md">
                                      {block.exam.source}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="text-sm font-medium text-ink mb-5 leading-relaxed">
                                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{block.exam.question}</Markdown>
                              </div>
                              
                              <div className="mb-4 p-4 bg-paper border-2 border-surface-mid rounded-xl text-sm text-ink-secondary flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-surface-low flex items-center justify-center shrink-0">
                                  <PenTool size={20} className="text-ink-muted" />
                                </div>
                                <div>
                                  <p className="font-bold text-ink">Grab a pen and paper!</p>
                                  <p className="text-xs">Solve this exercise on paper. When you are finished, check the solution below.</p>
                                </div>
                              </div>
                              
                              <AnimatePresence>
                                {examHintShown[index] && (
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mb-4 p-4 bg-warning-soft rounded-xl border border-warning/20 text-warning text-sm"
                                  >
                                    <div className="flex gap-2">
                                      <Lightbulb className="w-5 h-5 shrink-0" />
                                      <p><span className="font-bold">Hint:</span> {block.exam.hint}</p>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {!examResult[index] ? (
                                <div className="flex gap-3">
                                  <button 
                                    className="flex-1 py-3 bg-paper border-2 border-surface-mid text-ink-secondary rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-surface-mid transition-colors flex items-center justify-center gap-2" 
                                    onClick={() => setExamHintShown(prev => ({ ...prev, [index]: true }))}
                                    disabled={examHintShown[index]}
                                  >
                                    <Lightbulb size={16} />
                                    {examHintShown[index] ? 'Hint Shown' : 'Show Hint'}
                                  </button>
                                  <button 
                                    className="flex-[2] py-3 bg-accent text-paper rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2" 
                                    onClick={() => handleExamSubmit(index, block.exam!.solution)}
                                  >
                                    <CheckCircle2 size={16} />
                                    I'm Done, Show Solution
                                  </button>
                                </div>
                              ) : (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="p-4 rounded-xl bg-surface-low border border-surface-mid"
                                >
                                  <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-success" />
                                    <div className="w-full">
                                      <p className="font-bold text-sm mb-1 text-ink">
                                        Solution
                                      </p>
                                      <div className="text-xs opacity-90 leading-relaxed mt-2 pt-2 border-t border-current/10 text-ink">
                                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{block.exam.solution}</Markdown>
                                      </div>
                                      
                                      <div className="mt-4 pt-4 border-t border-surface-mid flex items-center justify-between">
                                        <p className="text-xs font-bold text-ink-secondary">Did you get it right?</p>
                                        <div className="flex gap-2">
                                          <button 
                                            onClick={() => setXp(prev => Math.min(100, prev + 20))}
                                            className="px-3 py-1.5 bg-success-soft text-success rounded-lg text-xs font-bold hover:bg-success/20 transition-colors"
                                          >
                                            Yes (+20 XP)
                                          </button>
                                          <button 
                                            className="px-3 py-1.5 bg-error-soft text-error rounded-lg text-xs font-bold hover:bg-error/20 transition-colors"
                                          >
                                            No, I need to review
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          )}

                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </article>
                );
              })
            ) : (
              <div className="p-12 text-center space-y-4 bg-surface-low rounded-3xl border border-dashed border-ink/10">
                <div className="w-16 h-16 rounded-full bg-paper mx-auto flex items-center justify-center text-muted/30">
                  <BookOpen size={32} />
                </div>
                <div>
                  <h3 className="font-bold text-ink">No blocks found</h3>
                  <p className="text-sm text-muted">This lesson doesn't have any content blocks yet.</p>
                </div>
              </div>
            )}
          </div>
        </div>


        {/* Footer Navigation */}
        <footer className="flex gap-4 pt-8">
          <button 
            onClick={() => navigate(-1)}
            className="flex-1 h-12 bg-paper border border-surface-mid rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-ink-secondary hover:bg-surface-low transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button 
            onClick={markLessonComplete}
            className="flex-1 h-12 bg-ink text-paper rounded-xl flex items-center justify-center gap-2 text-xs font-bold hover:bg-accent transition-colors"
          >
            Complete Lesson
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </footer>
        </>
        )}

        {activeTab === 'quizzes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                <Target size={20} className="text-accent" />
                Lesson Quizzes
              </h3>
            </div>
            {isLoadingExtra ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-accent" /></div>
            ) : quizzes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quizzes.map((quiz) => (
                  <div key={quiz.id} className="bg-paper border border-ink/5 p-5 rounded-2xl hover:border-accent/30 transition-all cursor-pointer">
                    <h4 className="font-bold text-ink">{quiz.title}</h4>
                    <p className="text-sm text-muted mt-1">{quiz.description}</p>
                    <div className="flex items-center gap-3 mt-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-surface-low px-2 py-1 rounded text-muted">{quiz.difficulty}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-surface-low px-2 py-1 rounded text-muted">{quiz.questions?.length || 0} Questions</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-surface-low/50 border border-dashed border-ink/10 rounded-3xl p-16 text-center">
                <p className="text-muted">No quizzes available for this lesson yet.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'exercises' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                <Dumbbell size={20} className="text-accent" />
                Practice Exercises
              </h3>
            </div>
            {isLoadingExtra ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-accent" /></div>
            ) : exercises.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exercises.map((exercise) => (
                  <div key={exercise.id} className="bg-paper border border-ink/5 p-5 rounded-2xl hover:border-accent/30 transition-all cursor-pointer">
                    <h4 className="font-bold text-ink">{exercise.title}</h4>
                    <p className="text-sm text-muted mt-1 line-clamp-2">{exercise.prompt}</p>
                    <div className="flex items-center gap-3 mt-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-surface-low px-2 py-1 rounded text-muted">{exercise.difficulty}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-surface-low/50 border border-dashed border-ink/10 rounded-3xl p-16 text-center">
                <p className="text-muted">No exercises available for this lesson yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>



      {/* Lesson Outline Modal */}
      <Modal
        isOpen={showOutlineModal}
        onClose={() => {
          setShowOutlineModal(false);
          // Stop audio when modal closes
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setReadingBlockIndex(null);
          }
        }}
        title="Lesson Outline"
      >
        <div className="space-y-4">
          <div className="p-4 bg-accent/5 rounded-xl border border-accent/10 space-y-2">
            <h3 className="font-bold text-accent">Audio Reading</h3>
            <p className="text-sm text-muted">Click any section title to hear it read aloud. Click again to stop.</p>
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            {effectiveLesson?.blocks?.map((block, index) => {
              const isReading = readingBlockIndex === index;
              return (
                <button
                  key={block.id || index}
                  onClick={() => toggleReadAloud(index, block.content || '')}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                    isReading
                      ? 'bg-accent/10 border-accent/30 shadow-sm'
                      : 'bg-surface-low border-ink/5 hover:border-accent/30 hover:bg-surface-mid'
                  }`}
                >
                  <div className="flex-1">
                    <span className="text-xs font-bold text-muted uppercase tracking-wider mb-1 block">
                      Section {index + 1}
                    </span>
                    <h4 className={`font-bold ${isReading ? 'text-accent' : 'text-ink'}`}>
                      {block.title || 'Untitled Section'}
                    </h4>
                  </div>

                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    isReading ? 'bg-accent text-paper' : 'bg-surface-mid text-ink-secondary'
                  }`}>
                    {isReading ? (
                      <div className="w-4 h-4 flex items-center justify-center gap-1">
                        <span className="w-1 h-3 bg-paper rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 h-4 bg-paper rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 h-3 bg-paper rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    )}
                  </div>
                </button>
              );
            })}

            {(!effectiveLesson?.blocks || effectiveLesson.blocks.length === 0) && (
              <div className="text-center p-8 text-muted">
                No sections found in this lesson.
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Reminder Modal */}
      <Modal
        isOpen={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        title="Set a Reminder"
      >
        <div className="space-y-6">
          <div className="p-6 bg-accent/5 rounded-2xl border border-accent/10 space-y-4">
            <div className="flex items-center gap-3 text-accent">
              <Bell className="w-6 h-6" />
              <h3 className="font-bold text-lg">Study Reminder</h3>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              Set a reminder to revisit this lesson or complete a specific task related to it.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Reminder Text</label>
            <input 
              type="text"
              value={reminderText}
              onChange={(e) => setReminderText(e.target.value)}
              placeholder="e.g. Review the Gestalt principles tomorrow"
              className="w-full p-4 bg-surface-low border border-ink/5 rounded-xl text-sm focus:outline-none focus:border-accent/30 transition-all"
            />
          </div>

          <button 
            onClick={handleAddReminder}
            disabled={!reminderText}
            className="w-full py-4 bg-ink text-paper rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all disabled:opacity-50 shadow-xl shadow-ink/20"
          >
            Save Reminder
          </button>
        </div>
      </Modal>

      {/* Note Modal */}
      <Modal
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        title="Add a Note"
      >
        <div className="space-y-6">
          <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <StickyNote className="w-6 h-6" />
              <h3 className="font-bold text-lg">Personal Note</h3>
            </div>
            <p className="text-sm text-emerald-800/70 leading-relaxed">
              Capture your thoughts, questions, or key takeaways from this lesson.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Note Content</label>
            <textarea 
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="What's on your mind?"
              rows={4}
              className="w-full p-4 bg-surface-low border border-ink/5 rounded-xl text-sm focus:outline-none focus:border-accent/30 transition-all resize-none"
            />
          </div>

          <button 
            onClick={handleAddNote}
            disabled={!noteContent}
            className="w-full py-4 bg-emerald-600 text-paper rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-xl shadow-emerald-600/20"
          >
            Save Note
          </button>
        </div>
      </Modal>

      <EduWorkspace 
        isOpen={isWorkspaceOpen}
        onClose={() => setIsWorkspaceOpen(false)}
        subjectId={effectiveLesson?.moduleId || 'math'}
        lessonContext={{
          title: lesson?.title || '',
          content: effectiveLesson?.blocks?.map(b => b.content || '').join('\n') || effectiveLesson?.content || '',
          grade: selectedGrade,
          country: selectedCountry
        }}
      />

      <AIAssistant
        lessonContent={effectiveLesson?.blocks?.map((b: any) => b.content || '').join('\n') || effectiveLesson?.content || ''}
        strictRAG={module?.strictRAG}
        subject={module?.name}
        grade={selectedGrade}
        aiAvailable={aiAvailable}
      />
    </Layout>
  );
};
