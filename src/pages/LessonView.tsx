import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { SEO } from '../components/SEO';
import { EduWorkspace } from '../components/workspace/EduWorkspace';
import { db } from '../db/db';
import { supabase } from '../db/supabase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LessonReader } from '../features/lesson/LessonReader';
import { SupportZoneModal } from '../components/SupportZoneModal';
import { useDisplayedLessonBlocks } from '../features/lesson/useDisplayedLessonBlocks';
import { AIAssistant } from '../components/AIAssistant';
import { getLessonSelectColumns, inferLegacyLessonSourceConfidence, inferLegacyLessonSourceName, inferLegacyLessonValidationStatus, isMissingLessonValidationColumnError } from '../services/lessonSupabase';
import { isStudentVisibleLesson, getLessonAvailabilityState } from '../services/lessonRecovery';
import { isDraftValidationStatus } from '../services/curriculumValidation';
import { getQuizzesByLesson } from '../services/quizService';
import { getExercisesByLesson } from '../services/exerciseService';

// ⚡ Bolt Performance Optimization: Stable empty array for `useLiveQuery` fallbacks
// Prevents unnecessary re-renders when data is undefined by maintaining referential equality
const EMPTY_ARRAY: any[] = [];

type SupabaseLessonRecord = {
  id?: string;
  topic_id?: string | null;
  lesson_title: string;
  content?: string | null;
  blocks?: any[] | null;
  quizzes?: any[] | null;
  exercises?: any[] | null;
  subtitle?: string | null;
  tags?: string[] | null;
  status?: string | null;
  grade?: string | null;
  country?: string | null;
  subject?: string | null;
  validation_status?: string | null;
  source_confidence?: number | null;
  source_name?: string | null;
  source_url?: string | null;
  review_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  is_ai_generated?: boolean | null;
  teaching_contract?: unknown;
  bannerImage?: string | null;
};

type CurriculumContext = {
  lesson_id?: string | null;
  lesson_title?: string | null;
  topic_id?: string | null;
  topic_title?: string | null;
  grade_id?: string | null;
  grade_name?: string | null;
  subject_id?: string | null;
  subject_name?: string | null;
  subject_code?: string | null;
  domain_id?: string | null;
  domain_code?: string | null;
  domain_name?: string | null;
  domain_order?: number | null;
  validation_status?: string | null;
  lesson_status?: string | null;
};

type LessonNavigationState = {
  from?: string;
  classroomId?: string;
  moduleId?: string;
  gradeId?: string;
  subjectId?: string;
  startAtTest?: boolean;
};

const getAvailabilityRank = (lesson: any) => {
  const state = getLessonAvailabilityState(lesson);
  switch (state) {
    case 'published': return 5;
    case 'needs_review': return 4;
    case 'draft_with_content': return 3;
    case 'locked': return 2;
    case 'rejected': return 1;
    default: return 0;
  }
};

const stripMarkdown = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[#>*_~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const truncateText = (text: string, max = 155) =>
  text.length <= max ? text : `${text.slice(0, max).trim()}...`;

const applyInstructionOptionTopicFilter = (query: any, optionId: string) => {
  const normalizedOptionId = String(optionId || '').trim();
  if (!normalizedOptionId) return query.is('instruction_option_id', null);
  return query.or(`instruction_option_id.eq.${normalizedOptionId},instruction_option_id.is.null`);
};

const isRTL = (text: string) => /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const relativeTime = (ts: number) => {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const getBlockText = (block: any) =>
  [
    block?.title,
    block?.content,
    block?.question,
    block?.quiz?.question,
    block?.exercise?.question,
    block?.exercise?.prompt,
    block?.exam?.question,
    ...(Array.isArray(block?.points) ? block.points : []),
    ...(Array.isArray(block?.rules) ? block.rules : []),
  ].filter(Boolean).join(' ');

const buildLessonDescription = (lesson: any, fallback: string) => {
  const blockPreview = Array.isArray(lesson?.blocks)
    ? lesson.blocks.map((block: any) => getBlockText(block)).filter(Boolean).join(' ')
    : '';
  return truncateText(stripMarkdown(lesson?.subtitle || lesson?.content || blockPreview || fallback));
};

const isFrenchLesson = (values: Array<string | null | undefined>) =>
  values.some((value) => {
    const normalized = normalizeSearchText(String(value || ''));
    return normalized === 'francais' || normalized === 'langue francaise' || normalized.includes('francais');
  });

const getExpectedAnswer = (block: any) =>
  String(
    block?.exercise?.answer ||
    block?.exercise?.solution ||
    block?.answer ||
    block?.solution ||
    '',
  ).trim();

const PendingLessonView: React.FC<{ title: string; lessonId: string; onReady: () => void; onBack: () => void }> = ({ title, lessonId, onReady, onBack }) => {
  const [stage, setStage] = useState(0);
  const stages = ['Preparing lesson', 'Organizing sections', 'Checking content', 'Saving'];

  useEffect(() => {
    const stageInterval = setInterval(() => setStage((value) => Math.min(value + 1, stages.length - 1)), 8000);
    const handleReady = () => {
      clearInterval(stageInterval);
      db.lessons.update(lessonId, { status: 'done' }).then(onReady);
    };

    window.addEventListener('lesson-ready', handleReady);
    return () => {
      clearInterval(stageInterval);
      window.removeEventListener('lesson-ready', handleReady);
    };
  }, [lessonId, onReady, stages.length]);

  return (
    <Layout fullWidth>
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 px-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
        <div className="max-w-md space-y-2">
          <p className="text-lg font-semibold text-ink">{title}</p>
          <p className="text-sm font-medium text-accent">{stages[stage]}...</p>
          <p className="text-xs text-muted">The lesson will be available when preparation finishes.</p>
        </div>
        <button onClick={onBack} className="text-xs text-muted transition-colors hover:text-accent">
          Back
        </button>
      </div>
    </Layout>
  );
};

export const LessonView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useLanguage();
  const { isAdmin } = useAuth();
  const lesson = useLiveQuery(() => (id ? db.lessons.get(id) : undefined), [id]);
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || EMPTY_ARRAY;
  const settingsMap = useMemo(() => {
    if (!Array.isArray(dbSettings)) return {};
    return Object.fromEntries(dbSettings.map((setting) => [setting.key, setting.value]));
  }, [dbSettings]);
  const selectedInstructionOptionId = String(settingsMap.selected_bac_int_option || localStorage.getItem('selected_bac_int_option') || '');
  const navigationState = (location.state || {}) as LessonNavigationState;

  const startAtTest = navigationState.startAtTest || false;

  const [supabaseLesson, setSupabaseLesson] = useState<SupabaseLessonRecord | null>(null);
  const [supabaseQuizzes, setSupabaseQuizzes] = useState<any[]>([]);
  const [supabaseExercises, setSupabaseExercises] = useState<any[]>([]);
  const [curriculumContext, setCurriculumContext] = useState<CurriculumContext | null>(null);
  const [curriculumOrderedLessons, setCurriculumOrderedLessons] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDomain, setActiveDomain] = useState('all');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [readingBlockIndex, setReadingBlockIndex] = useState<number | null>(null);
  const [quizAnswered, setQuizAnswered] = useState<Record<number, boolean>>({});
  const [quizCorrect, setQuizCorrect] = useState<Record<number, boolean>>({});
  const [quizSelectedOption, setQuizSelectedOption] = useState<Record<number, string>>({});
  const [exerciseResult, setExerciseResult] = useState<Record<number, 'correct' | 'wrong' | 'shown' | null>>({});
  const [exerciseHintShown, setExerciseHintShown] = useState<Record<number, boolean>>({});
  const [examResult, setExamResult] = useState<Record<number, 'correct' | 'wrong' | 'shown' | null>>({});
  const [examHintShown, setExamHintShown] = useState<Record<number, boolean>>({});
  const blockRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    setQuizAnswered({});
    setQuizCorrect({});
    setQuizSelectedOption({});
    setExerciseResult({});
    setExerciseHintShown({});
    setExamResult({});
    setExamHintShown({});
    setReadingBlockIndex(null);
    setActiveDomain('all');
    setSupabaseQuizzes([]);
    setSupabaseExercises([]);
    setCurriculumContext(null);
    setCurriculumOrderedLessons([]);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let isCancelled = false;

    const fetchLesson = async () => {
      setIsLoading(true);
      const fetchAttempt = async (includeValidation: boolean) => {
        const selectColumns = getLessonSelectColumns({ includeTags: true, includeValidation });
        const query = supabase
          .from('lessons')
          .select(selectColumns)
          .or(`id.eq.${id},topic_id.eq.${id}`);
        const { data, error } = await query;
        if (error) throw error;
        return data;
      };

      try {
        let data;
        try {
          data = await fetchAttempt(true);
        } catch (error) {
          if (!isMissingLessonValidationColumnError(error)) throw error;
          data = await fetchAttempt(false);
        }

        if (isCancelled) return;
        const lessonsList = (data as SupabaseLessonRecord[]) || [];
        
        let foundLesson: SupabaseLessonRecord | null = null;
        if (lessonsList.length > 0) {
          const sortedLessons = [...lessonsList].sort((a, b) => getAvailabilityRank(b) - getAvailabilityRank(a));
          foundLesson = sortedLessons[0];
        }

        let dbQuizzes: any[] = [];
        let dbExercises: any[] = [];
        if (foundLesson?.id) {
          try {
            const [fetchedQuizzes, fetchedExercises] = await Promise.all([
              getQuizzesByLesson(foundLesson.id),
              getExercisesByLesson(foundLesson.id),
            ]);
            dbQuizzes = fetchedQuizzes || [];
            dbExercises = fetchedExercises || [];
          } catch (e) {
            console.warn('[LessonView] Failed to fetch quizzes/exercises from Supabase:', e);
          }
        }

        if (isCancelled) return;
        setSupabaseLesson(foundLesson);
        setSupabaseQuizzes(dbQuizzes);
        setSupabaseExercises(dbExercises);

        if (foundLesson?.id) {
          const { data: context } = await supabase
            .from('lesson_curriculum_context')
            .select('*')
            .eq('lesson_id', foundLesson.id)
            .maybeSingle();

          if (!isCancelled && context) {
            setCurriculumContext(context as CurriculumContext);
          }
        }
      } catch (error) {
        console.warn('[LessonView] Failed to load lesson from Supabase:', error);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    fetchLesson();
    return () => {
      isCancelled = true;
    };
  }, [id]);

  const effectiveLesson = useMemo(() => {
    if (supabaseLesson) {
      return {
        id: supabaseLesson.id,
        moduleId: lesson?.moduleId || undefined,
        title: supabaseLesson.lesson_title,
        content: supabaseLesson.content || '',
        blocks: Array.isArray(supabaseLesson.blocks) ? supabaseLesson.blocks : [],
        quizzes: Array.isArray(supabaseLesson.quizzes) ? supabaseLesson.quizzes : [],
        exercises: Array.isArray(supabaseLesson.exercises) ? supabaseLesson.exercises : [],
        subtitle: supabaseLesson.subtitle || '',
        tags: supabaseLesson.tags || [],
        status: supabaseLesson.status || 'published',
        grade: curriculumContext?.grade_name || supabaseLesson.grade || '',
        country: supabaseLesson.country || '',
        subject: curriculumContext?.subject_name || supabaseLesson.subject || '',
        topic_id: supabaseLesson.topic_id || undefined,
        validation_status: supabaseLesson.validation_status || inferLegacyLessonValidationStatus(supabaseLesson),
        source_confidence: supabaseLesson.source_confidence ?? inferLegacyLessonSourceConfidence(supabaseLesson) ?? undefined,
        source_name: supabaseLesson.source_name || inferLegacyLessonSourceName(supabaseLesson),
        is_ai_generated: supabaseLesson.is_ai_generated ?? undefined,
        bannerImage: supabaseLesson.bannerImage || undefined,
      };
    }

    if (lesson) {
      return {
        ...lesson,
        title: lesson.title,
        content: lesson.content || '',
        blocks: Array.isArray(lesson.blocks) ? lesson.blocks : [],
        quizzes: Array.isArray((lesson as any).quizzes) ? (lesson as any).quizzes : [],
        exercises: Array.isArray((lesson as any).exercises) ? (lesson as any).exercises : [],
        subtitle: lesson.subtitle || '',
        grade: lesson.grade || '',
        subject: lesson.subject || '',
        bannerImage: lesson.bannerImage || undefined,
      } as any;
    }

    return undefined;
  }, [lesson, supabaseLesson, curriculumContext]);

  const smartBackTarget = useMemo(() => {
    if (navigationState.from) return navigationState.from;
    const classroomId = navigationState.classroomId || navigationState.moduleId || effectiveLesson?.moduleId || lesson?.moduleId;
    return classroomId ? `/classroom/${classroomId}` : '/dashboard';
  }, [effectiveLesson?.moduleId, lesson?.moduleId, navigationState.classroomId, navigationState.from, navigationState.moduleId]);

  const lessonNavigationState = useMemo<LessonNavigationState>(() => ({
    ...navigationState,
    classroomId: navigationState.classroomId || navigationState.moduleId || effectiveLesson?.moduleId || lesson?.moduleId,
    moduleId: navigationState.moduleId || effectiveLesson?.moduleId || lesson?.moduleId,
    gradeId: navigationState.gradeId || curriculumContext?.grade_id || undefined,
    subjectId: navigationState.subjectId || curriculumContext?.subject_id || undefined,
    startAtTest: false,
  }), [curriculumContext?.grade_id, curriculumContext?.subject_id, effectiveLesson?.moduleId, lesson?.moduleId, navigationState]);

  useEffect(() => {
    const gradeId = curriculumContext?.grade_id || navigationState.gradeId;
    const subjectId = curriculumContext?.subject_id || navigationState.subjectId;
    if (!gradeId || !subjectId) {
      setCurriculumOrderedLessons([]);
      return;
    }

    let isCancelled = false;
    const fetchCurriculumLessons = async () => {
      try {
        const fetchTopics = async (includeDomains: boolean) => {
          const query = supabase
            .from('topics')
            .select(includeDomains
              ? 'id, title, topic_order, grade_id, subject_id, instruction_option_id, subject_domains(domain_order)'
              : 'id, title, topic_order, grade_id, subject_id, instruction_option_id')
            .eq('grade_id', gradeId)
            .eq('subject_id', subjectId)
            .order('topic_order', { ascending: true });

          return applyInstructionOptionTopicFilter(query, selectedInstructionOptionId);
        };

        let { data: topics, error: topicsError } = await fetchTopics(true);
        if (topicsError) {
          const fallback = await fetchTopics(false);
          topics = fallback.data;
          topicsError = fallback.error;
        }
        if (topicsError) throw topicsError;

        const orderedTopics = [...(topics || [])].sort((left: any, right: any) => {
          const leftDomainOrder = Number(left.subject_domains?.domain_order ?? 999);
          const rightDomainOrder = Number(right.subject_domains?.domain_order ?? 999);
          return leftDomainOrder - rightDomainOrder || String(left.title || '').localeCompare(String(right.title || ''));
        });
        const topicIds = orderedTopics.map((topic: any) => topic.id).filter(Boolean);
        if (topicIds.length === 0) {
          if (!isCancelled) setCurriculumOrderedLessons([]);
          return;
        }

        const fetchLessons = async (includeValidation: boolean) => supabase
          .from('lessons')
          .select(getLessonSelectColumns({ includeTags: true, includeValidation }))
          .in('topic_id', topicIds);

        let lessonRows;
        try {
          const { data, error } = await fetchLessons(true);
          if (error) throw error;
          lessonRows = data;
        } catch (error) {
          if (!isMissingLessonValidationColumnError(error)) throw error;
          const { data, error: fallbackError } = await fetchLessons(false);
          if (fallbackError) throw fallbackError;
          lessonRows = data;
        }

        const lessonsByTopic = new Map<string, any>();
        for (const row of lessonRows || []) {
          const topicId = String(row.topic_id || '');
          if (!topicId) continue;
          const current = lessonsByTopic.get(topicId);
          if (!current || getAvailabilityRank(row) > getAvailabilityRank(current)) {
            lessonsByTopic.set(topicId, row);
          }
        }

        const ordered = orderedTopics
          .map((topic: any) => lessonsByTopic.get(String(topic.id)))
          .filter(Boolean)
          .filter((row: any) => isAdmin || isStudentVisibleLesson(row))
          .map((row: any) => ({
            ...row,
            id: row.id,
            title: row.lesson_title,
            moduleId: navigationState.moduleId || navigationState.classroomId || lesson?.moduleId,
            grade: curriculumContext?.grade_name || row.grade || '',
            subject: curriculumContext?.subject_name || row.subject || '',
          }));

        if (!isCancelled) setCurriculumOrderedLessons(ordered);
      } catch (error) {
        console.warn('[LessonView] Failed to load curriculum lesson navigation:', error);
        if (!isCancelled) setCurriculumOrderedLessons([]);
      }
    };

    fetchCurriculumLessons();
    return () => {
      isCancelled = true;
    };
  }, [curriculumContext, isAdmin, lesson?.moduleId, navigationState.classroomId, navigationState.gradeId, navigationState.moduleId, navigationState.subjectId, selectedInstructionOptionId]);

  // Use moduleId from effective lesson, falling back to subject_id from curriculum or the lesson's own module
  const targetModuleId = effectiveLesson?.moduleId || curriculumContext?.subject_id || lesson?.moduleId;
  const lessonsInModule = useLiveQuery(
    () => (targetModuleId ? db.lessons.where('moduleId').equals(targetModuleId).sortBy('createdAt') : Promise.resolve([])),
    [targetModuleId]
  );

  const localOrderedLessons = useMemo(() => {
    if (!lessonsInModule) return [];
    return lessonsInModule.filter((l) => {
      if (l.status === 'suggested') return false;
      return isAdmin || isStudentVisibleLesson(l);
    });
  }, [lessonsInModule, isAdmin]);

  const orderedLessons = curriculumOrderedLessons.length > 0 ? curriculumOrderedLessons : localOrderedLessons;

  // Fetch notes for all lessons in this classroom/module
  const lessonIdsForNotes = useMemo(() => (orderedLessons || EMPTY_ARRAY).map(l => l.id), [orderedLessons]);
  const classroomNotes = useLiveQuery(
    async () => {
      if (lessonIdsForNotes.length === 0) return [];
      return db.notes.where('lessonId').anyOf(lessonIdsForNotes).toArray();
    },
    [lessonIdsForNotes]
  );

  // Fetch all reminders/tasks to capture completed classroom checkmarks
  const remindersVal = useLiveQuery(() => db.tasks.toArray());
  const reminders = remindersVal || EMPTY_ARRAY;

  // Local state to log Pomodoro focus timer starts dynamically
  const [pomodoroLogs, setPomodoroLogs] = useState<Array<{
    id: string;
    title: string;
    timestamp: number;
  }>>([]);

  const [timerSeconds, setTimerSeconds] = useState(1500); // 25 minutes
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  const defaultDuration = Number(settingsMap['default_session_duration'] || localStorage.getItem('default_session_duration') || 25);
  const currentGrade = settingsMap['selected_grade'] || localStorage.getItem('selected_grade') || '';

  useEffect(() => {
    if (defaultDuration) {
      setTimerSeconds(defaultDuration * 60);
    }
  }, [defaultDuration]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  useEffect(() => {
    if (isTimerRunning) {
      setPomodoroLogs(prev => [
        {
          id: `pomodoro-${Date.now()}`,
          title: 'Started Deep Focus',
          timestamp: Date.now()
        },
        ...prev
      ].slice(0, 5));
    }
  }, [isTimerRunning]);

  const activityLogs = useMemo(() => {
    const logs: Array<{
      id: string;
      type: 'lesson_completed' | 'lesson_pending' | 'note_added' | 'pomodoro_start' | 'reminder_completed';
      title: string;
      subtitle?: string;
      timestamp: number;
    }> = [];

    // 1. Completed & Pending Lessons
    (orderedLessons || []).forEach(lesson => {
      if (lesson.status === 'done') {
        logs.push({
          id: `completed-${lesson.id}`,
          type: 'lesson_completed',
          title: lesson.title,
          subtitle: 'Marked as completed',
          timestamp: lesson.createdAt || Date.now()
        });
      } else if (lesson.status === 'pending') {
        logs.push({
          id: `pending-${lesson.id}`,
          type: 'lesson_pending',
          title: lesson.title,
          subtitle: 'AI curation pending',
          timestamp: lesson.createdAt || Date.now()
        });
      }
    });

    // 2. Classroom Study Notes
    if (classroomNotes && orderedLessons) {
      const lessonTitleById = new Map(orderedLessons.map(l => [l.id, l.title]));
      classroomNotes.forEach(note => {
        const lessonTitle = lessonTitleById.get(note.lessonId) || 'a lesson';
        logs.push({
          id: `note-${note.id}`,
          type: 'note_added',
          title: `Note in ${lessonTitle}`,
          subtitle: note.content.length > 30 ? note.content.substring(0, 30) + '...' : note.content,
          timestamp: note.createdAt
        });
      });
    }

    // 3. Completed Reminders (matching this subject module / category)
    if (reminders && effectiveLesson) {
      reminders.forEach(task => {
        if (task.completed) {
          const isRelated = task.title.toLowerCase().includes(effectiveLesson.title.toLowerCase()) || 
                            (effectiveLesson.subject && task.title.toLowerCase().includes(effectiveLesson.subject.toLowerCase()));
          if (isRelated) {
            logs.push({
              id: `task-${task.id}`,
              type: 'reminder_completed',
              title: task.title,
              subtitle: 'Checklist reminder completed',
              timestamp: task.createdAt || Date.now()
            });
          }
        }
      });
    }

    // 4. Pomodoro start events
    pomodoroLogs.forEach(pl => {
      logs.push({
        id: pl.id,
        type: 'pomodoro_start',
        title: pl.title,
        subtitle: 'Deep focus session started',
        timestamp: pl.timestamp
      });
    });

    return logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [orderedLessons, classroomNotes, reminders, effectiveLesson, pomodoroLogs]);

  const currentIndex = useMemo(() => {
    if (!orderedLessons || !effectiveLesson) return -1;
    return orderedLessons.findIndex((l) => l.id === effectiveLesson.id);
  }, [orderedLessons, effectiveLesson]);

  const prevLesson = useMemo(() => {
    if (currentIndex <= 0) return null;
    return orderedLessons[currentIndex - 1];
  }, [orderedLessons, currentIndex]);

  const nextLesson = useMemo(() => {
    if (currentIndex === -1 || currentIndex >= orderedLessons.length - 1) return null;
    return orderedLessons[currentIndex + 1];
  }, [orderedLessons, currentIndex]);

  const storedBlocks = Array.isArray(effectiveLesson?.blocks) ? effectiveLesson.blocks : [];
  const readerSourceBlocks = useMemo(() => {
    let baseBlocks = [...storedBlocks];
    if (baseBlocks.length === 0 && effectiveLesson?.content?.trim()) {
      baseBlocks = [{ type: 'content', title: effectiveLesson.title, content: effectiveLesson.content }];
    }

    // 1. Gather all quizzes from Supabase separate table and embedded column/local record
    const allRawQuizzes = [
      ...supabaseQuizzes,
      ...(effectiveLesson?.quizzes || [])
    ];

    // Deduplicate quizzes by question text
    const uniqueQuizQuestions: any[] = [];
    const seenQuizTexts = new Set<string>();

    for (const quiz of allRawQuizzes) {
      if (!quiz) continue;
      // Sometimes it's a flat list of questions directly, sometimes it has a .questions array, sometimes a single question object
      const questionsList = Array.isArray(quiz.questions) 
        ? quiz.questions 
        : Array.isArray(quiz)
        ? quiz
        : [quiz];

      for (const q of questionsList) {
        if (!q) continue;
        const qText = (q.question || q.questionText || q.text || '').trim();
        if (qText && !seenQuizTexts.has(qText)) {
          seenQuizTexts.add(qText);
          uniqueQuizQuestions.push({
            question: qText,
            options: q.options || q.choices || [],
            correctAnswer: q.correctAnswer || q.answer || '',
            explanation: q.explanation || '',
          });
        }
      }
    }

    const mappedQuizzes = uniqueQuizQuestions.map((q, qIdx) => ({
      id: `supabase-quiz-${qIdx}`,
      type: 'quiz',
      purpose: 'quiz',
      title: effectiveLesson?.title || 'Quiz',
      quiz: q
    }));

    // 2. Gather all exercises from Supabase separate table and embedded column/local record
    const allRawExercises = [
      ...supabaseExercises,
      ...(effectiveLesson?.exercises || [])
    ];

    // Deduplicate exercises by prompt
    const uniqueExercises: any[] = [];
    const seenExercisePrompts = new Set<string>();

    for (const ex of allRawExercises) {
      if (!ex) continue;
      // Could be an array of exercises, or a single exercise
      const exList = Array.isArray(ex) ? ex : [ex];
      for (const singleEx of exList) {
        if (!singleEx) continue;
        const exPrompt = (singleEx.prompt || singleEx.question || '').trim();
        if (exPrompt && !seenExercisePrompts.has(exPrompt)) {
          seenExercisePrompts.add(exPrompt);
          uniqueExercises.push({
            title: singleEx.title || 'Practice Exercise',
            prompt: exPrompt,
            solution: singleEx.solution || singleEx.answer || '',
            hint: singleEx.hints?.[0] || singleEx.hint || '',
          });
        }
      }
    }

    const mappedExercises = uniqueExercises.map((ex, exIdx) => ({
      id: `supabase-exercise-${exIdx}`,
      type: 'exercise',
      purpose: 'practice',
      title: ex.title,
      exercise: {
        prompt: ex.prompt,
        solution: ex.solution,
        hint: ex.hint,
      }
    }));

    return [...baseBlocks, ...mappedQuizzes, ...mappedExercises];
  }, [effectiveLesson?.content, effectiveLesson?.title, effectiveLesson?.quizzes, effectiveLesson?.exercises, storedBlocks, supabaseQuizzes, supabaseExercises]);
  const hasStoredContent = Boolean(effectiveLesson?.content?.trim()) || readerSourceBlocks.length > 0;
  const contentDir = isRTL(`${effectiveLesson?.title || ''} ${getBlockText(readerSourceBlocks[0]) || effectiveLesson?.content || ''}`)
    ? 'rtl'
    : language === 'ar'
      ? 'rtl'
      : 'ltr';
  const lessonIsFrench = isFrenchLesson([
    curriculumContext?.subject_name,
    curriculumContext?.subject_code,
    effectiveLesson?.subject,
    effectiveLesson?.title,
  ]);
  const {
    allBlocks,
    displayedBlocks,
    domainStats,
    showDomainFilters,
  } = useDisplayedLessonBlocks({
    blocks: readerSourceBlocks,
    activeDomain,
    isFrenchLesson: lessonIsFrench,
  });
  const metaDescription = buildLessonDescription(
    { ...effectiveLesson, blocks: readerSourceBlocks },
    `${effectiveLesson?.subject || 'Curriculum'} lesson for ${effectiveLesson?.grade || 'students'} on LevelSpace.`,
  );

  const quizzesCount = useMemo(() => {
    return readerSourceBlocks.filter((b: any) => b.purpose === 'quiz' || b.type === 'quiz').length;
  }, [readerSourceBlocks]);

  const exercisesCount = useMemo(() => {
    return readerSourceBlocks.filter((b: any) => b.purpose === 'practice' || b.purpose === 'exam' || b.type === 'practice' || b.type === 'exam').length;
  }, [readerSourceBlocks]);

  const hasTests = quizzesCount > 0 || exercisesCount > 0;

  const toggleReadAloud = (sourceIndex: number, text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (readingBlockIndex === sourceIndex) {
      setReadingBlockIndex(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = contentDir === 'rtl' ? 'ar' : 'fr-FR';
    utterance.onend = () => setReadingBlockIndex(null);
    utterance.onerror = () => setReadingBlockIndex(null);
    setReadingBlockIndex(sourceIndex);
    window.speechSynthesis.speak(utterance);
  };

  const handleQuizAnswer = (blockIndex: number, option: string, correctAnswer: string) => {
    if (quizAnswered[blockIndex]) return;
    setQuizSelectedOption((current) => ({ ...current, [blockIndex]: option }));
    setQuizAnswered((current) => ({ ...current, [blockIndex]: true }));
    setQuizCorrect((current) => ({ ...current, [blockIndex]: option === correctAnswer }));
  };

  const handleExerciseSubmit = (sourceIndex: number, solution: string) => {
    const expected = getExpectedAnswer(readerSourceBlocks[sourceIndex]);
    if (!expected) {
      setExerciseResult((current) => ({ ...current, [sourceIndex]: 'shown' }));
      return;
    }

    const normalizedSolution = normalizeSearchText(solution);
    const normalizedExpected = normalizeSearchText(expected);
    setExerciseResult((current) => ({
      ...current,
      [sourceIndex]: normalizedSolution && (normalizedExpected.includes(normalizedSolution) || normalizedSolution.includes(normalizedExpected))
        ? 'correct'
        : 'wrong',
    }));
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    await db.notes.add({
      id: crypto.randomUUID(),
      lessonId: id || effectiveLesson?.id || 'lesson',
      content: noteContent.trim(),
      createdAt: Date.now(),
    });
    setNoteContent('');
    setShowNoteModal(false);
  };

  const handleUpdateBanner = async (url: string) => {
    if (effectiveLesson?.id) {
      await db.lessons.update(effectiveLesson.id, { bannerImage: url });
    }
    setSupabaseLesson(prev => prev ? { ...prev, bannerImage: url } : null);
  };

  if (isLoading || lessonsInModule === undefined) {
    return (
      <Layout fullWidth>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </Layout>
    );
  }

  if (!effectiveLesson) {
    return (
      <Layout fullWidth>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <AlertCircle className="h-12 w-12 text-error" />
          <p className="font-medium text-ink">{t('lesson_not_found')}</p>
          <button onClick={() => navigate(smartBackTarget)} className="text-accent hover:underline">Back</button>
        </div>
      </Layout>
    );
  }

  if (!isAdmin && !isStudentVisibleLesson(effectiveLesson)) {
    return (
      <Layout fullWidth>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <AlertCircle className="h-12 w-12 text-error" />
          <p className="font-medium text-ink">{t('lesson_unavailable')}</p>
          <p className="max-w-lg text-sm text-muted">{t('lesson_unavailable_desc')}</p>
          <button onClick={() => navigate(smartBackTarget)} className="text-accent hover:underline">Back</button>
        </div>
      </Layout>
    );
  }

  if (effectiveLesson.status === 'pending' && !hasStoredContent) {
    return <PendingLessonView title={effectiveLesson.title} lessonId={id!} onReady={() => window.location.reload()} onBack={() => navigate(smartBackTarget)} />;
  }

  return (
    <Layout fullWidth topbarGradeOverride={effectiveLesson.grade}>
      <SEO
        title={effectiveLesson.title}
        description={metaDescription}
        keywords={[
          effectiveLesson.title,
          effectiveLesson.subject,
          effectiveLesson.grade,
          curriculumContext?.domain_name,
          'LevelSpace',
        ].filter(Boolean).join(', ')}
        type="article"
      />

      <div dir={contentDir} className="h-full w-full bg-background flex flex-col overflow-hidden p-4">
        <LessonReader
          title={effectiveLesson.title}
          subtitle={effectiveLesson.subtitle || `${displayedBlocks.length} sections`}
          grade={effectiveLesson.grade}
          subject={effectiveLesson.subject}
          draftWarning={isDraftValidationStatus(effectiveLesson.validation_status, !!effectiveLesson.is_ai_generated)}
          displayedBlocks={displayedBlocks}
          allBlocks={allBlocks}
          domainStats={domainStats}
          activeDomain={activeDomain}
          showDomainFilters={showDomainFilters}
          readingBlockIndex={readingBlockIndex}
          quizAnswered={quizAnswered}
          quizCorrect={quizCorrect}
          quizSelectedOption={quizSelectedOption}
          exerciseResult={exerciseResult}
          exerciseHintShown={exerciseHintShown}
          examResult={examResult}
          examHintShown={examHintShown}
          onBack={() => navigate(smartBackTarget)}
          onDomainChange={setActiveDomain}
          onAddNote={() => setShowNoteModal(true)}
          onReadBlock={toggleReadAloud}
          onOpenWorkspace={() => setIsWorkspaceOpen(true)}
          onQuizAnswer={handleQuizAnswer}
          onExerciseSubmit={handleExerciseSubmit}
          onShowExerciseHint={(sourceIndex) => setExerciseHintShown((current) => ({ ...current, [sourceIndex]: true }))}
          onExamSubmit={(sourceIndex) => setExamResult((current) => ({ ...current, [sourceIndex]: 'shown' }))}
          onShowExamHint={(sourceIndex) => setExamHintShown((current) => ({ ...current, [sourceIndex]: true }))}
          blockRefs={blockRefs}
          prevLesson={prevLesson}
          nextLesson={nextLesson}
          onNavigateToLesson={(lessonId) => navigate(`/lesson/${lessonId}`, { state: lessonNavigationState })}
          hasTests={hasTests}
          bannerImage={effectiveLesson.bannerImage}
          onUpdateBanner={handleUpdateBanner}
          startAtTest={startAtTest}
          allLessonsInModule={orderedLessons}
          timerSeconds={timerSeconds}
          isTimerRunning={isTimerRunning}
          onTimerRunningChange={setIsTimerRunning}
          onTimerReset={() => { setIsTimerRunning(false); setTimerSeconds(defaultDuration * 60); }}
          isSupportModalOpen={isSupportModalOpen}
          onSupportModalOpenChange={setIsSupportModalOpen}
          activityLogs={activityLogs}
          defaultDuration={defaultDuration}
        />

        <Modal isOpen={showNoteModal} onClose={() => setShowNoteModal(false)} title="Add a note">
          <div className="space-y-5">
            <p className="text-sm leading-relaxed text-muted">Capture a question, reminder, or takeaway from this lesson.</p>
            <textarea
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              placeholder="Write your note..."
              rows={5}
              className="w-full resize-none rounded-2xl border border-ink/10 bg-surface-low p-4 text-sm text-ink outline-none transition-colors focus:border-accent/40"
            />
            <button
              type="button"
              onClick={handleAddNote}
              disabled={!noteContent.trim()}
              className="w-full rounded-xl bg-ink py-3 text-[10px] font-bold uppercase tracking-normal text-paper transition-colors hover:bg-accent disabled:opacity-50"
            >
              Save note
            </button>
          </div>
        </Modal>

        <EduWorkspace
          isOpen={isWorkspaceOpen}
          onClose={() => setIsWorkspaceOpen(false)}
          subjectId={effectiveLesson.topic_id || effectiveLesson.id || 'lesson'}
          lessonContext={{
            title: effectiveLesson.title,
            content: readerSourceBlocks.map((block: any) => getBlockText(block)).join('\n'),
            grade: effectiveLesson.grade,
            country: effectiveLesson.country,
          }}
        />

        <AIAssistant
          title={effectiveLesson.title}
          lessonContent={readerSourceBlocks.map((block: any) => getBlockText(block)).join('\n')}
          subject={effectiveLesson.subject}
          grade={effectiveLesson.grade}
          strictRAG={true}
        />

        <SupportZoneModal
          isOpen={isSupportModalOpen}
          onClose={() => setIsSupportModalOpen(false)}
          grade={currentGrade || "Grade 9"}
        />
      </div>
    </Layout>
  );
};
