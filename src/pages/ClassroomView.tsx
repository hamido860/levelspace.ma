import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { ShieldCheck, AlertTriangle, ArrowLeft, BookOpen, Plus, ChevronRight, CheckCircle2, Clock, Brain, Sparkles, Loader2, Play, Target, Dumbbell, Database, Pin, Timer, RefreshCw, Activity, FileText, CheckSquare } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { SupportZoneModal } from '../components/SupportZoneModal';
import { db } from '../db/db';
import { supabase } from '../db/supabase';
import { TagsManager } from '../components/TagsManager';
import { generateSeedLesson, generateLessonSuggestions, LessonSuggestion, checkAIProvider } from '../services/geminiService';
import { aiCrew } from '../services/aiCrewService';
import { getQuizzesByLesson } from '../services/quizService';
import { getExercisesByLesson } from '../services/exerciseService';
import { filterStudentVisibleLessons, isStudentVisibleLesson, getLessonAvailabilityState } from '../services/lessonRecovery';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getGradeCandidates, getSubjectCandidates, normalizeCurriculumValue, pickBestCurriculumMatch } from '../services/curriculumMatching';
import { FRENCH_SUBJECT_DOMAINS } from '../services/curriculumStructure';
import {
  getLessonSelectColumns,
  inferLegacyLessonSourceConfidence,
  inferLegacyLessonSourceName,
  inferLegacyLessonValidationStatus,
  isMissingLessonValidationColumnError,
} from '../services/lessonSupabase';
import {
  compareCurriculumValidationForStudents,
  getCurriculumValidationBadgeClass,
  getCurriculumValidationLabel,
  selectStudentFacingValidatedContent,
} from '../services/curriculumValidation';
import { HorizontalSlider } from '../components/HorizontalSlider';
import { LayoutGrid, Rows3 } from 'lucide-react';

const normalizeLessonTitle = (title: string | null | undefined) =>
  String(title || '').trim().toLocaleLowerCase();

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

const relativeTime = (ts: number) => {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};


type SupabaseLessonRow = {
  id?: string;
  topic_id?: string | null;
  lesson_title: string;
  content?: string | null;
  blocks?: any[] | null;
  subtitle?: string | null;
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
  tags?: string[] | null;
  teaching_contract?: unknown;
};

type SupabaseTopicRow = {
  id: string;
  title: string;
  domain_id?: string | null;
  domain_code?: string | null;
  domain_name?: string | null;
  domain_order?: number | null;
  outlines: SupabaseTopicOutlineRow[];
};

type SupabaseTopicOutlineRow = {
  id: string;
  topic_id: string;
  title: string;
  description: string;
  outline_order: number;
};

type ClassroomDomain = {
  key: string;
  code: string;
  name: string;
  order: number;
};

const FRENCH_DOMAIN_TITLE_PREFIXES: Record<string, string[]> = {
  GRAMMAIRE: ['grammaire', 'langue'],
  CONJUGAISON: ['conjugaison'],
  ORTHOGRAPHE: ['orthographe'],
  LEXIQUE: ['lexique', 'vocabulaire'],
  LECTURE: ['lecture'],
  EXPRESSION_ECRITE: ['expression ecrite', 'production ecrite', 'redaction', 'la production ecrite'],
  COMMUNICATION_ORALE: ['communication orale', 'oral'],
};

const inferFrenchDomainCodeFromTitle = (title: string | null | undefined) => {
  const normalizedTitle = normalizeCurriculumValue(String(title || ''));
  if (!normalizedTitle) return null;

  for (const domain of FRENCH_SUBJECT_DOMAINS) {
    const normalizedName = normalizeCurriculumValue(domain.name);
    const prefixes = FRENCH_DOMAIN_TITLE_PREFIXES[domain.code] || [];
    const matchesDomainName =
      normalizedTitle === normalizedName ||
      normalizedTitle.startsWith(`${normalizedName}:`) ||
      normalizedTitle.startsWith(`${normalizedName} -`);
    const matchesPrefix = prefixes.some((prefix) => {
      const normalizedPrefix = normalizeCurriculumValue(prefix);
      return (
        normalizedTitle === normalizedPrefix ||
        normalizedTitle.startsWith(`${normalizedPrefix}:`) ||
        normalizedTitle.startsWith(`${normalizedPrefix} -`)
      );
    });

    if (matchesDomainName || matchesPrefix) return domain.code;
  }

  return null;
};

const CLASSROOM_TAB_CONFIG = {
  lessons: {
    label: 'Lessons',
    icon: BookOpen,
    activeClass: 'border-accent bg-accent/10 text-accent',
    iconClass: 'text-accent',
  },
  quizzes: {
    label: 'Quizzes',
    icon: Target,
    activeClass: 'border-warning bg-warning/10 text-warning',
    iconClass: 'text-warning',
  },
  exercises: {
    label: 'Exercises',
    icon: Dumbbell,
    activeClass: 'border-success bg-success/10 text-success',
    iconClass: 'text-success',
  },
} as const;

const resolvedCurriculumCache = new Map<string, { gradeId: string | null; subjectId: string | null; subjectIds: string[] }>();

const resolveCurriculumIds = async (grade: string, subject: string, category?: string | null) => {
  const cacheKey = `${grade}:${subject}:${category || ''}`;
  if (resolvedCurriculumCache.has(cacheKey)) {
    return resolvedCurriculumCache.get(cacheKey)!;
  }

  const gradeCandidates = getGradeCandidates(grade);
  const subjectCandidates = getSubjectCandidates(subject, category);

  const [{ data: grades }, { data: subjects }] = await Promise.all([
    supabase.from('grades').select('id, name').in('name', gradeCandidates),
    supabase.from('subjects').select('id, name').in('name', subjectCandidates),
  ]);

  const matchedGrade = pickBestCurriculumMatch<{ id: string; name?: string | null }>(grades as any, gradeCandidates);
  const matchedSubject = pickBestCurriculumMatch<{ id: string; name?: string | null }>(subjects as any, subjectCandidates);
  const normalizedSubjectCandidates = new Set(subjectCandidates.map(normalizeCurriculumValue));
  const subjectIds = ((subjects || []) as Array<{ id: string; name?: string | null }>)
    .filter((row) => normalizedSubjectCandidates.has(normalizeCurriculumValue(String(row.name || ''))))
    .map((row) => row.id);

  const result = {
    gradeId: matchedGrade?.id ?? null,
    subjectId: matchedSubject?.id ?? null,
    subjectIds: Array.from(new Set([matchedSubject?.id, ...subjectIds].filter(Boolean) as string[])),
  };

  resolvedCurriculumCache.set(cacheKey, result);
  return result;
};

type ClassroomSupabaseLesson = {
  id?: string;
  lesson_title?: string;
  content?: string | null;
  blocks?: any[] | null;
  subtitle?: string | null;
  status?: string | null;
  teaching_contract?: unknown;
  validation_status?: string | null;
  source_confidence?: number | null;
  source_name?: string | null;
  source_url?: string | null;
  review_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  is_ai_generated?: boolean | null;
};

export const ClassroomView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const [generatingTitle, setGeneratingTitle] = useState<string | null>(null);
  const [isFetchingGallery, setIsFetchingGallery] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isGeneratingStarterLessons, setIsGeneratingStarterLessons] = useState(false);
  const [isHydratingSupabase, setIsHydratingSupabase] = useState(false);
  const [topicFallbackRows, setTopicFallbackRows] = useState<SupabaseTopicRow[]>([]);
  const [curriculumTopicRows, setCurriculumTopicRows] = useState<SupabaseTopicRow[]>([]);
  const [suggestions, setSuggestions] = useState<LessonSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'lessons' | 'quizzes' | 'exercises'>('lessons');
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [isLoadingExtra, setIsLoadingExtra] = useState(false);
  const [cloudLessonsCount, setCloudLessonsCount] = useState<number | null>(null);
  const aiAvailable = checkAIProvider();
  const [activeDomainKey, setActiveDomainKey] = useState<string>('all');
  // Layout mode: grid or carousel
  const [layoutMode, setLayoutMode] = useState<'grid' | 'carousel'>('grid');

  // ── Pinned lessons state (module-scoped, shared with LessonReader) ──
  const pinStorageKey = `levelspace_pinned_lessons_${id || 'global'}`;
  const [pinnedLessonIds, setPinnedLessonIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(pinStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const togglePinLesson = (lessonId: string) => {
    setPinnedLessonIds(prev => {
      const next = prev.includes(lessonId)
        ? prev.filter(x => x !== lessonId)
        : [...prev, lessonId];
      localStorage.setItem(pinStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const module = useLiveQuery(() => id ? db.modules.get(id) : undefined, [id]);
  const allLessons = useLiveQuery(() => id ? db.lessons.where('moduleId').equals(id).sortBy('createdAt') : [], [id]);

  // Fetch notes for all lessons in this classroom
  const lessonIds = useMemo(() => (allLessons || []).map(l => l.id), [allLessons]);
  const classroomNotes = useLiveQuery(
    async () => {
      if (lessonIds.length === 0) return [];
      return db.notes.where('lessonId').anyOf(lessonIds).toArray();
    },
    [lessonIds]
  );

  // Fetch all reminders/tasks to capture completed classroom checkmarks
  const remindersVal = useLiveQuery(() => db.tasks.toArray());
  const reminders = remindersVal || [];

  // Local state to log Pomodoro focus timer starts dynamically
  const [pomodoroLogs, setPomodoroLogs] = useState<Array<{
    id: string;
    title: string;
    timestamp: number;
  }>>([]);

  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(1500); // 25 minutes
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const activityLogs = useMemo(() => {
    const logs: Array<{
      id: string;
      type: 'lesson_completed' | 'lesson_pending' | 'note_added' | 'pomodoro_start' | 'reminder_completed';
      title: string;
      subtitle?: string;
      timestamp: number;
    }> = [];

    // 1. Completed & Pending Lessons
    (allLessons || []).forEach(lesson => {
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
    if (classroomNotes && allLessons) {
      const lessonTitleById = new Map(allLessons.map(l => [l.id, l.title]));
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
    if (reminders && module) {
      reminders.forEach(task => {
        if (task.completed) {
          const isRelated = task.title.toLowerCase().includes(module.name.toLowerCase()) || 
                            (module.category && task.title.toLowerCase().includes(module.category.toLowerCase()));
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
  }, [allLessons, classroomNotes, reminders, module, pomodoroLogs]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(pinStorageKey);
      if (saved) {
        setPinnedLessonIds(JSON.parse(saved));
      } else if (allLessons && allLessons.length > 0) {
        // Default to first 3 lessons if no pins are saved yet
        const defaultPins = allLessons.slice(0, 3).map((l: any) => l.id);
        setPinnedLessonIds(defaultPins);
        localStorage.setItem(pinStorageKey, JSON.stringify(defaultPins));
      }
    } catch {
      setPinnedLessonIds([]);
    }
  }, [pinStorageKey, allLessons?.length]);
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const settingsMap = useMemo(() => Object.fromEntries(dbSettings.map(s => [s.key, s.value])), [dbSettings]);

  const defaultDuration = Number(settingsMap['default_session_duration'] || localStorage.getItem('default_session_duration') || 25);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

  const currentGrade = settingsMap['selected_grade'] || localStorage.getItem('selected_grade') || 'Grade 12';
  const currentCountry = settingsMap['selected_country'] || localStorage.getItem('selected_country') || '';
  const selectedBacTrack = settingsMap['selected_bac_track'] || localStorage.getItem('selected_bac_track') || '';
  const gradeCandidates = useMemo(() => getGradeCandidates(currentGrade), [currentGrade]);
  const normalizedGradeCandidates = useMemo(
    () => new Set(gradeCandidates.map((grade) => String(grade || '').trim().toLocaleLowerCase())),
    [gradeCandidates],
  );
  const normalizedCurrentCountry = String(currentCountry || '').trim().toLocaleLowerCase();
  const filteredScopeLessons = useMemo(
    () =>
      (allLessons || []).filter((lesson) => {
        if (lesson.status === 'suggested') return false;

        const lessonGrade = String(lesson.grade || '').trim().toLocaleLowerCase();
        if (lessonGrade && !normalizedGradeCandidates.has(lessonGrade)) {
          return false;
        }

        const lessonCountry = String(lesson.country || '').trim().toLocaleLowerCase();
        if (normalizedCurrentCountry && lessonCountry) {
          const isMatch =
            (normalizedCurrentCountry === 'morocco' || normalizedCurrentCountry === 'maroc')
              ? (lessonCountry === 'morocco' || lessonCountry === 'maroc')
              : lessonCountry === normalizedCurrentCountry;
          if (!isMatch) return false;
        }

        return true;
      }),
    [allLessons, normalizedCurrentCountry, normalizedGradeCandidates],
  );
  const studentVisibleLessons = useMemo(
    () => filterStudentVisibleLessons(filteredScopeLessons),
    [filteredScopeLessons],
  );
  const storedLessons = useMemo(
    () => [...filteredScopeLessons].sort(compareCurriculumValidationForStudents),
    [filteredScopeLessons],
  );
  const studentLessonSelection = useMemo(
    () => selectStudentFacingValidatedContent(studentVisibleLessons),
    [studentVisibleLessons],
  );
  const lessons = useMemo(() => {
    if (isAdmin) {
      return storedLessons;
    }
    if (studentVisibleLessons.length > 0) {
      return studentLessonSelection.hasPreferred
        ? studentLessonSelection.preferredOnly
        : studentLessonSelection.fallback;
    }
    return storedLessons;
  }, [isAdmin, storedLessons, studentVisibleLessons.length, studentLessonSelection]);
  const hasLessons = lessons.length > 0;
  const adminStats = useMemo(() => {
    if (!isAdmin) return null;
    let published = 0;
    let needsReview = 0;
    let draft = 0;
    let hidden = 0;
    
    for (const lesson of storedLessons) {
      const state = getLessonAvailabilityState(lesson);
      if (state === 'published') {
        published++;
      } else {
        hidden++;
        if (state === 'needs_review') {
          needsReview++;
        } else if (state === 'draft_with_content') {
          draft++;
        }
      }
    }
    
    return {
      total: storedLessons.length,
      published,
      needsReview,
      draft,
      hidden,
    };
  }, [isAdmin, storedLessons]);
  const hasTopicFallback = !hasLessons && topicFallbackRows.length > 0;
  const topicDomainRows = curriculumTopicRows.length > 0 ? curriculumTopicRows : topicFallbackRows;
  const topicDomainById = useMemo(() => {
    const domains = new Map<string, ClassroomDomain>();
    for (const topic of topicDomainRows) {
      if (!topic.id || !topic.domain_name) continue;

      const key = topic.domain_id || topic.domain_code || topic.domain_name;
      if (!key) continue;

      domains.set(topic.id, {
        key,
        code: topic.domain_code || "DOMAIN",
        name: topic.domain_name,
        order: topic.domain_order ?? 999,
      });
    }
    return domains;
  }, [topicDomainRows]);
  const topicFallbackDomains = useMemo(() => {
    const domains = new Map<string, ClassroomDomain>();
    for (const topic of topicDomainRows) {
      const key = topic.domain_id || topic.domain_code || topic.domain_name;
      if (!key || !topic.domain_name) continue;
      domains.set(key, {
        key,
        code: topic.domain_code || "DOMAIN",
        name: topic.domain_name,
        order: topic.domain_order ?? 999,
      });
    }
    return Array.from(domains.values()).sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
  }, [topicDomainRows]);
  const frenchDomainByCode = useMemo(
    () => new Map(FRENCH_SUBJECT_DOMAINS.map((domain) => [domain.code, domain])),
    [],
  );
  const lessonDomainStats = useMemo(() => {
    if (!hasLessons) return topicFallbackDomains.map((domain) => ({ ...domain, count: 0 }));

    const counts = new Map<string, ClassroomDomain & { count: number }>();
    for (const lesson of lessons) {
      const domain =
        (lesson.topic_id ? topicDomainById.get(lesson.topic_id) : undefined) ||
        (() => {
          const code = inferFrenchDomainCodeFromTitle(lesson.title);
          const frenchDomain = code ? frenchDomainByCode.get(code) : undefined;
          return frenchDomain
            ? { key: frenchDomain.code, code: frenchDomain.code, name: frenchDomain.name, order: frenchDomain.order }
            : undefined;
        })();

      if (!domain) continue;

      const existing = counts.get(domain.key);
      counts.set(domain.key, {
        ...domain,
        count: (existing?.count || 0) + 1,
      });
    }

    return Array.from(counts.values()).sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
  }, [frenchDomainByCode, hasLessons, lessons, topicDomainById, topicFallbackDomains]);
  const showDomainTabs = lessonDomainStats.length > 0 || topicFallbackDomains.length > 0;
  const visibleLessons = useMemo(() => {
    if (!showDomainTabs || activeDomainKey === 'all') return lessons;

    return lessons.filter((lesson) => {
      const domain =
        (lesson.topic_id ? topicDomainById.get(lesson.topic_id) : undefined) ||
        (() => {
          const code = inferFrenchDomainCodeFromTitle(lesson.title);
          const frenchDomain = code ? frenchDomainByCode.get(code) : undefined;
          return frenchDomain
            ? { key: frenchDomain.code, code: frenchDomain.code, name: frenchDomain.name, order: frenchDomain.order }
            : undefined;
        })();

      return domain?.key === activeDomainKey;
    });
  }, [activeDomainKey, frenchDomainByCode, lessons, showDomainTabs, topicDomainById]);
  const visibleTopicFallbackRows = useMemo(() => {
    if (!showDomainTabs || activeDomainKey === 'all') return topicFallbackRows;

    return topicFallbackRows.filter((topic) => {
      const key = topic.domain_id || topic.domain_code || topic.domain_name;
      return key === activeDomainKey;
    });
  }, [activeDomainKey, showDomainTabs, topicFallbackRows]);
  const hasSupplementalContent = quizzes.length > 0 || exercises.length > 0;
  const showStats = module?.progress > 0 || hasLessons || hasTopicFallback;
  const showTabs = true;
  const showSetupState = !hasLessons && !hasTopicFallback && !isHydratingSupabase && suggestions.length === 0;
  const showValidationWarningBanner = !isAdmin && lessons.length > 0 && !studentLessonSelection.hasPreferred;
  const cloudHydrationKeyRef = useRef<string | null>(null);
  const classroomScopeKey = `${id || ''}:${module?.name || ''}:${module?.category || ''}:${currentGrade}:${currentCountry}:${selectedBacTrack}`;

  useEffect(() => {
    if (!id) return;
    if (module?.name) return;

    (async () => {
      try {
        const { data: subject, error } = await supabase
          .from('subjects')
          .select('id, name')
          .eq('id', id)
          .single();

        if (error || !subject) return;

        await db.modules.put({
          id: subject.id,
          name: subject.name,
          code: subject.name.slice(0, 3).toUpperCase(),
          description: 'Supabase curriculum subject',
          category: 'General',
          progress: 0,
          selected: false,
          tags: [],
          strictRAG: false,
          createdAt: Date.now(),
        });
      } catch (error) {
        console.warn('[ClassroomView] Failed to hydrate module cache from subject route:', error);
      }
    })();
  }, [id, module?.name]);

  const fetchSupabaseLessons = async () => {
    if (!module) return [] as SupabaseLessonRow[];

    const subjectCandidates = getSubjectCandidates(module.name, module.category);
    const { gradeId, subjectId, subjectIds } = await resolveCurriculumIds(currentGrade, module.name, module.category);
    const fetchAttempt = async (includeValidation: boolean) => {
      const selectColumns = getLessonSelectColumns({ includeValidation, includeTags: true });

      if (gradeId && (subjectIds.length > 0 || subjectId)) {
        const { data: topicRows, error: topicsError } = await supabase
          .from('topics')
          .select('id, title')
          .eq('grade_id', gradeId)
          .in('subject_id', subjectIds.length > 0 ? subjectIds : [subjectId]);

        if (topicsError) throw topicsError;

        const topicIds = (topicRows || []).map((topic) => topic.id).filter(Boolean);
        if (topicIds.length > 0) {
          let topicLessonQuery = supabase
            .from('lessons')
            .select(selectColumns)
            .in('topic_id', topicIds);

          if (currentCountry) {
            const countryNormalized = String(currentCountry).trim().toLowerCase();
            const countryCandidates = 
              countryNormalized === 'morocco' || countryNormalized === 'maroc'
                ? ['Morocco', 'Maroc', 'morocco', 'maroc']
                : [currentCountry];
            topicLessonQuery = topicLessonQuery.in('country', countryCandidates);
          }

          const { data: topicLessons, error: topicLessonsError } = await topicLessonQuery;
          if (topicLessonsError) throw topicLessonsError;

          if ((topicLessons || []).length > 0) {
            return (topicLessons || []) as SupabaseLessonRow[];
          }
        }
      }

      let exactGradeQuery = supabase
        .from('lessons')
        .select(selectColumns)
        .in('subject', subjectCandidates)
        .eq('grade', currentGrade);

      if (currentCountry) {
        const countryNormalized = String(currentCountry).trim().toLowerCase();
        const countryCandidates = 
          countryNormalized === 'morocco' || countryNormalized === 'maroc'
            ? ['Morocco', 'Maroc', 'morocco', 'maroc']
            : [currentCountry];
        exactGradeQuery = exactGradeQuery.in('country', countryCandidates);
      }

      const { data: exactGradeLessons, error: exactGradeError } = await exactGradeQuery;
      if (exactGradeError) throw exactGradeError;

      if ((exactGradeLessons || []).length > 0) {
        return (exactGradeLessons || []) as SupabaseLessonRow[];
      }

      let fallbackQuery = supabase
        .from('lessons')
        .select(selectColumns)
        .in('subject', subjectCandidates)
        .in('grade', gradeCandidates);

      if (currentCountry) {
        const countryNormalized = String(currentCountry).trim().toLowerCase();
        const countryCandidates = 
          countryNormalized === 'morocco' || countryNormalized === 'maroc'
            ? ['Morocco', 'Maroc', 'morocco', 'maroc']
            : [currentCountry];
        fallbackQuery = fallbackQuery.in('country', countryCandidates);
      }

      const { data, error } = await fallbackQuery;
      if (error) throw error;

      return (data || []) as SupabaseLessonRow[];
    };

    try {
      return await fetchAttempt(true);
    } catch (error) {
      if (isMissingLessonValidationColumnError(error)) {
        console.warn('[ClassroomView] Lesson validation columns are missing in Supabase; retrying with legacy lesson schema.');
        return fetchAttempt(false);
      }

      throw error;
    }
  };

  const fetchSupabaseTopics = async () => {
    if (!module) return [] as SupabaseTopicRow[];

    const { gradeId, subjectId, subjectIds } = await resolveCurriculumIds(currentGrade, module.name, module.category);
    if (!gradeId || (!subjectId && subjectIds.length === 0)) return [] as SupabaseTopicRow[];

    const fetchTopics = async (includeDomains: boolean) => supabase
      .from('topics')
      .select(includeDomains ? 'id, title, domain_id, subject_domains(code, name, domain_order)' : 'id, title')
      .eq('grade_id', gradeId)
      .in('subject_id', subjectIds.length > 0 ? subjectIds : [subjectId])
      .order('title', { ascending: true });

    let { data, error } = await fetchTopics(true);
    if (error) {
      console.warn('[ClassroomView] topic domain metadata unavailable for fallback:', error);
      const fallback = await fetchTopics(false);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    const topics = (data || [])
      .map((topic) => ({
        id: String(topic.id),
        title: String(topic.title || '').trim(),
        domain_id: 'domain_id' in topic ? String(topic.domain_id || '') || null : null,
        domain_code: String((topic as any).subject_domains?.code || '').trim() || null,
        domain_name: String((topic as any).subject_domains?.name || '').trim() || null,
        domain_order: Number((topic as any).subject_domains?.domain_order ?? 999),
        outlines: [] as SupabaseTopicOutlineRow[],
      }))
      .filter((topic) => topic.id && topic.title);

    if (topics.length === 0) return topics;

    const outlinesByTopicId = new Map<string, SupabaseTopicOutlineRow[]>();
    const topicIds = topics.map((topic) => topic.id);

    const batchPromises = [];
    for (let start = 0; start < topicIds.length; start += 100) {
      const batch = topicIds.slice(start, start + 100);
      batchPromises.push(
        supabase
          .from('topic_outlines')
          .select('id, topic_id, title, description, outline_order')
          .in('topic_id', batch)
          .order('outline_order', { ascending: true })
      );
    }

    const batchResults = await Promise.all(batchPromises);

    for (const { data: outlineRows, error: outlinesError } of batchResults) {
      if (outlinesError) {
        console.warn('[ClassroomView] topic_outlines unavailable for topic fallback:', outlinesError);
        continue;
      }

      for (const outline of outlineRows || []) {
        const topicId = String(outline.topic_id || '');
        if (!topicId) continue;

        const list = outlinesByTopicId.get(topicId) || [];
        list.push({
          id: String(outline.id),
          topic_id: topicId,
          title: String(outline.title || '').trim(),
          description: String(outline.description || '').trim(),
          outline_order: Number(outline.outline_order || list.length + 1),
        });
        outlinesByTopicId.set(topicId, list);
      }
    }

    return topics.map((topic) => ({
      ...topic,
      outlines: (outlinesByTopicId.get(topic.id) || []).sort((left, right) => left.outline_order - right.outline_order),
    }));
  };

  const hydrateLessonCache = async (cloudLessons: SupabaseLessonRow[]) => {
    if (!module) return;

    const currentStoredLessons = await db.lessons.where('moduleId').equals(module.id).sortBy('createdAt');
    const existingById = new Map(currentStoredLessons.map((lesson) => [lesson.id, lesson]));
    const existingByTitle = new Map(currentStoredLessons.map((lesson) => [normalizeLessonTitle(lesson.title), lesson]));

    const toPut = cloudLessons.map((lesson) => {
      const existing =
        (lesson.id ? existingById.get(lesson.id) : undefined) ||
        existingByTitle.get(normalizeLessonTitle(lesson.lesson_title));
      const hasStoredContent =
        Boolean(lesson.content?.trim()) ||
        (Array.isArray(lesson.blocks) && lesson.blocks.length > 0);
      const normalizedStatus = String(lesson.status || '').toLowerCase();
      const tags = Array.isArray(lesson.tags) ? lesson.tags : existing?.tags || [];
      const isStarterNeedsReview = tags.includes('starter') || tags.includes('needs_review');

      const inferredValidationStatus =
        lesson.validation_status ??
        existing?.validation_status ??
        inferLegacyLessonValidationStatus(lesson);
      const inferredSourceConfidence =
        lesson.source_confidence ??
        existing?.source_confidence ??
        inferLegacyLessonSourceConfidence(lesson) ??
        0;
      const inferredSourceName =
        lesson.source_name ??
        existing?.source_name ??
        inferLegacyLessonSourceName(lesson);

      return {
        id: existing?.id || lesson.id || crypto.randomUUID(),
        moduleId: module.id,
        title: lesson.lesson_title,
        content: lesson.content || existing?.content || '',
        blocks: lesson.blocks ?? existing?.blocks,
        quizzes: (lesson as any).quizzes ?? (existing as any)?.quizzes,
        exercises: (lesson as any).exercises ?? (existing as any)?.exercises,
        subtitle: lesson.subtitle ?? existing?.subtitle,
        grade: lesson.grade ?? existing?.grade,
        country: lesson.country ?? existing?.country,
        subject: lesson.subject ?? existing?.subject ?? module.name,
        topic_id: lesson.topic_id ?? existing?.topic_id,
        sourceLessonId: lesson.id ?? existing?.sourceLessonId,
        teaching_contract: lesson.teaching_contract ?? existing?.teaching_contract,
        validation_status: inferredValidationStatus,
        source_confidence: Number(inferredSourceConfidence),
        source_name: inferredSourceName,
        source_url: lesson.source_url ?? existing?.source_url,
        review_notes: lesson.review_notes ?? existing?.review_notes,
        reviewed_by: lesson.reviewed_by ?? existing?.reviewed_by,
        reviewed_at: lesson.reviewed_at ?? existing?.reviewed_at,
        is_ai_generated: Boolean(lesson.is_ai_generated ?? existing?.is_ai_generated),
        status: hasStoredContent
          ? 'done' as const
          : isStarterNeedsReview
          ? 'pending' as const
          : (normalizedStatus === 'published' || normalizedStatus === 'done' || normalizedStatus === 'draft')
          ? 'done' as const
          : (existing?.status || 'pending') as 'suggested' | 'pending' | 'active' | 'done',
        tags,
        createdAt: existing?.createdAt || Date.now(),
      };
    });

    if (toPut.length > 0) {
      await db.lessons.bulkPut(toPut);
    }
  };

  // Hydrate the local classroom cache from Supabase so cloud stays the source of truth.
  useEffect(() => {
    if (!module || !id) return;
    if (cloudHydrationKeyRef.current === classroomScopeKey) return;

    cloudHydrationKeyRef.current = classroomScopeKey;

    (async () => {
      setIsHydratingSupabase(true);
      try {
        const [cloudLessons, topics] = await Promise.all([
          fetchSupabaseLessons(),
          fetchSupabaseTopics(),
        ]);
        setCurriculumTopicRows(topics);
        setCloudLessonsCount(cloudLessons.length);

        // Sync lesson_generation_jobs for topics that already have lessons
        try {
          const topicsWithLessons = cloudLessons
            .filter((lesson) => 
              lesson.topic_id && 
              (Boolean(lesson.content?.trim()) || (Array.isArray(lesson.blocks) && lesson.blocks.length > 0))
            )
            .map((lesson) => lesson.topic_id);

          if (topicsWithLessons.length > 0) {
            await supabase
              .from('lesson_generation_jobs')
              .update({
                status: 'needs_review',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                error_message: null
              })
              .eq('status', 'pending')
              .in('topic_id', topicsWithLessons);
          }
        } catch (jobErr) {
          console.warn('[ClassroomView] Job status sync warning:', jobErr);
        }

        if (cloudLessons.length === 0) {
          setTopicFallbackRows(topics);
          return;
        }
        setTopicFallbackRows([]);
        await hydrateLessonCache(cloudLessons);
      } catch (err) {
        cloudHydrationKeyRef.current = null;
        console.warn('[ClassroomView] Supabase classroom hydration failed:', err);
      } finally {
        setIsHydratingSupabase(false);
      }
    })();
  }, [classroomScopeKey, currentCountry, currentGrade, id, module, selectedBacTrack]);

  // Dev mode console diagnostics
  useEffect(() => {
    if (import.meta.env.DEV) {
      const hiddenNeedsReview = storedLessons.filter(l => {
        const isStudVis = isStudentVisibleLesson(l);
        const state = getLessonAvailabilityState(l);
        return !isStudVis && state === 'needs_review';
      }).length;

      console.log('[ClassroomView Diagnostics]', {
        cloudLessonsCount,
        hydratedLessonsCount: storedLessons.length,
        studentVisibleLessonsCount: studentVisibleLessons.length,
        hiddenNeedsReviewCount: hiddenNeedsReview,
        currentGrade,
        moduleName: module?.name,
        topicIdsCount: curriculumTopicRows.length,
      });
    }
  }, [cloudLessonsCount, storedLessons, studentVisibleLessons, currentGrade, module?.name, curriculumTopicRows]);

  useEffect(() => {
    if (!showDomainTabs) {
      setActiveDomainKey('all');
      return;
    }

    if (activeDomainKey !== 'all' && !lessonDomainStats.some((domain) => domain.key === activeDomainKey)) {
      setActiveDomainKey('all');
    }
  }, [activeDomainKey, lessonDomainStats, showDomainTabs]);

  useEffect(() => {
    const fetchExtraData = async () => {
      if (!lessons.length) return;
      setIsLoadingExtra(true);
      try {
        const lessonExtras = await Promise.all(
          lessons.map(async (lesson) => {
            const [lessonQuizzes, lessonExercises] = await Promise.all([
              getQuizzesByLesson(lesson.id),
              getExercisesByLesson(lesson.id),
            ]);

            return {
              quizzes: lessonQuizzes || [],
              exercises: lessonExercises || [],
            };
          })
        );

        setQuizzes(lessonExtras.flatMap((entry) => entry.quizzes));
        setExercises(lessonExtras.flatMap((entry) => entry.exercises));
      } catch (error) {
        console.error("Failed to fetch extra data:", error);
      } finally {
        setIsLoadingExtra(false);
      }
    };
    
    fetchExtraData();
  }, [lessons]);

  const fetchGallery = async () => {
    if (!module || !aiAvailable) return;
    setIsFetchingGallery(true);
    try {
      // Fetch existing topics from Supabase if they exist
      let existingTopics: string[] = [];
      try {
        const { gradeId, subjectId, subjectIds } = await resolveCurriculumIds(currentGrade, module.name, module.category);

        if (gradeId && (subjectIds.length > 0 || subjectId)) {
          const { data: topics } = await supabase
            .from('topics')
            .select('title')
            .eq('grade_id', gradeId)
            .in('subject_id', subjectIds.length > 0 ? subjectIds : [subjectId]);
          if (topics) {
            existingTopics = topics.map(t => t.title);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch topics from Supabase:", err);
      }

      // Check database first
      const existingSuggestions = (allLessons || []).filter((lesson) => {
        if (lesson.status !== 'suggested') return false;

        const lessonGrade = String(lesson.grade || '').trim().toLocaleLowerCase();
        if (lessonGrade && !normalizedGradeCandidates.has(lessonGrade)) {
          return false;
        }

        const lessonCountry = String(lesson.country || '').trim().toLocaleLowerCase();
        if (normalizedCurrentCountry && lessonCountry && lessonCountry !== normalizedCurrentCountry) {
          return false;
        }

        return true;
      });
        
      if (existingSuggestions.length > 0) {
        setSuggestions(existingSuggestions.map(s => ({ title: s.title, description: s.content })));
        return;
      }

      // If not in DB, fetch from net
      const gallery = await generateLessonSuggestions(module.name, currentGrade, currentCountry, 2, existingTopics);
      
      // Save to DB for future
      const newSuggestions = gallery.map(g => ({
        id: crypto.randomUUID(),
        moduleId: module.id,
        title: g.title,
        content: g.description,
        validation_status: 'ai_generated',
        source_confidence: 0,
        is_ai_generated: true,
        status: 'suggested' as const,
        createdAt: Date.now()
      }));
      await db.lessons.bulkPut(newSuggestions);
      
      setSuggestions(gallery);
    } catch (error) {
      console.error("Failed to fetch gallery:", error);
    } finally {
      setIsFetchingGallery(false);
    }
  };


  const buildChainContext = async (maxChars = 8000): Promise<string> => {
    if (!module) return '';
    const parts: string[] = [];
    const includedTitles = new Set<string>();

    // 1. Local lessons (IndexedDB)
    const localLessons = storedLessons;
    for (const l of localLessons) {
      includedTitles.add(normalizeLessonTitle(l.title));
      parts.push(`Title: ${l.title}\nContent: ${l.content || (l.blocks ? l.blocks.map((b: any) => b.content).join('\n') : '')}`);
    }

    // 2. Supabase lessons for this subject/grade/country (seed chaining)
    try {
      const dbLessons = await fetchSupabaseLessons();
      if (dbLessons) {
        for (const l of dbLessons.slice(0, 5)) {
          const normalizedTitle = normalizeLessonTitle(l.lesson_title);
          if (includedTitles.has(normalizedTitle)) continue;
          const entry = `Title: ${l.lesson_title}\nContent: ${l.content?.substring(0, 600) ?? ''}`;
          parts.push(entry);
          includedTitles.add(normalizedTitle);
        }
      }
    } catch { /* non-critical */ }

    const combined = parts.join('\n\n');
    return combined.length > maxChars ? combined.substring(0, maxChars) + '...' : combined;
  };

  const getAdminApiHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const accessToken = data?.session?.access_token;

    return {
      'Content-Type': 'application/json',
      'x-levelspace-demo-admin': 'true',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };
  };

  const handleGenerateLesson = async (title?: string, autoNavigate = false) => {
    if (!module || !aiAvailable) return;
    const lessonTitle = title || module.name;
    setGeneratingTitle(lessonTitle);
    try {
      const existingContext = await buildChainContext();

      const seedLesson = await generateSeedLesson(lessonTitle, currentGrade, currentCountry, 2, module.strictRAG, existingContext);
      if (seedLesson) {
        const newLessonId = crypto.randomUUID();
        await db.lessons.add({
          id: newLessonId,
          moduleId: module.id,
          title: seedLesson.title,
          content: '',
          blocks: seedLesson.blocks,
          subtitle: seedLesson.subtitle,
          grade: currentGrade,
          country: currentCountry || undefined,
          subject: module.name,
          validation_status: 'ai_generated',
          source_confidence: 0,
          is_ai_generated: true,
          status: 'pending',
          createdAt: Date.now()
        });
        
        // Remove from suggestions if it was one
        if (title) {
          setSuggestions(prev => prev.filter(s => s.title !== title));
          setSelectedSuggestions(prev => prev.filter(t => t !== title));
          
          // Remove from DB
          const existingSuggestion = await db.lessons
            .where('moduleId').equals(module.id)
            .filter(l => l.status === 'suggested' && l.title === title)
            .first();
          if (existingSuggestion) {
            await db.lessons.delete(existingSuggestion.id);
          }
        }

        if (autoNavigate) {
          navigate(`/lesson/${newLessonId}`);
        }
      }
    } catch (error) {
      console.error("Failed to generate lesson:", error);
    } finally {
      setGeneratingTitle(null);
    }
  };

  const handleCurateSelected = async () => {
    if (!module || selectedSuggestions.length === 0 || !aiAvailable) return;
    setGeneratingTitle('selected');
    try {
      const existingContext = await buildChainContext();

      const generatePromises = selectedSuggestions.map(async (title) => {
        const seedLesson = await generateSeedLesson(title, currentGrade, currentCountry, 2, module.strictRAG, existingContext);
        if (seedLesson) {
          await db.lessons.add({
            id: crypto.randomUUID(),
            moduleId: module.id,
            title: seedLesson.title,
            content: '',
            blocks: seedLesson.blocks,
            subtitle: seedLesson.subtitle,
            grade: currentGrade,
            country: currentCountry || undefined,
            subject: module.name,
            validation_status: 'ai_generated',
            source_confidence: 0,
            is_ai_generated: true,
            status: 'pending',
            createdAt: Date.now()
          });
          
          // Remove from DB
          const existingSuggestion = await db.lessons
            .where('moduleId').equals(module.id)
            .filter(l => l.status === 'suggested' && l.title === title)
            .first();
          if (existingSuggestion) {
            await db.lessons.delete(existingSuggestion.id);
          }
        }
      });
      await Promise.all(generatePromises);
      setSuggestions(prev => prev.filter(s => !selectedSuggestions.includes(s.title)));
      setSelectedSuggestions([]);
    } catch (error) {
      console.error("Failed to curate selected:", error);
    } finally {
      setGeneratingTitle(null);
    }
  };

  const handleCurateAll = async () => {
    if (!module || suggestions.length === 0 || !aiAvailable) return;
    setGeneratingTitle('all');
    try {
      const existingContext = await buildChainContext();

      const titles = suggestions.map(s => s.title);
      const generatePromises = titles.map(async (title) => {
        const seedLesson = await generateSeedLesson(title, currentGrade, currentCountry, 2, module.strictRAG, existingContext);
        if (seedLesson) {
          await db.lessons.add({
            id: crypto.randomUUID(),
            moduleId: module.id,
            title: seedLesson.title,
            content: '',
            blocks: seedLesson.blocks,
            subtitle: seedLesson.subtitle,
            grade: currentGrade,
            country: currentCountry || undefined,
            subject: module.name,
            validation_status: 'ai_generated',
            source_confidence: 0,
            is_ai_generated: true,
            status: 'pending',
            createdAt: Date.now()
          });
          
          // Remove from DB
          const existingSuggestion = await db.lessons
            .where('moduleId').equals(module.id)
            .filter(l => l.status === 'suggested' && l.title === title)
            .first();
          if (existingSuggestion) {
            await db.lessons.delete(existingSuggestion.id);
          }
        }
      });
      await Promise.all(generatePromises);
      setSuggestions([]);
      setSelectedSuggestions([]);
    } catch (error) {
      console.error("Failed to curate all:", error);
    } finally {
      setGeneratingTitle(null);
    }
  };

  const handleSeedFromSupabase = async () => {
    if (!module) return;
    setIsSeeding(true);
    try {
      const existingTitles = new Set(storedLessons.map((lesson) => normalizeLessonTitle(lesson.title)));
      const dbLessons = await fetchSupabaseLessons();

      if (!dbLessons || dbLessons.length === 0) {
        const topics = await fetchSupabaseTopics();
        setCurriculumTopicRows(topics);

        if (topics.length > 0) {
          setTopicFallbackRows(topics.filter((topic) => !existingTitles.has(normalizeLessonTitle(topic.title))));
          toast.info(`Topics found, but lessons are not generated yet. ${topics.length} topics available.`);
          setIsSeeding(false);
          return;
        }

        toast.info("No existing lessons found in Supabase for this curriculum.");
        setIsSeeding(false);
        return;
      }

      await hydrateLessonCache(dbLessons);
      setCurriculumTopicRows(await fetchSupabaseTopics());
      setTopicFallbackRows([]);
      cloudHydrationKeyRef.current = classroomScopeKey;

      // Enforce strict RAG mode for this module by default as requested
      await db.modules.update(module.id, { strictRAG: true });
      
      toast.success(`Seeded ${dbLessons.length} lessons from Supabase. Strict RAG mode enabled.`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to seed from Supabase: ' + err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleGenerateStarterLessons = async () => {
    if (!module || topicFallbackRows.length === 0) return;

    setIsGeneratingStarterLessons(true);
    try {
      const topicIds = topicFallbackRows.map((topic) => topic.id).filter(Boolean);
      const headers = await getAdminApiHeaders();
      let inserted = 0;
      let skipped = 0;

      const batches = [];
      for (let start = 0; start < topicIds.length; start += 25) {
        batches.push(topicIds.slice(start, start + 25));
      }

      const concurrencyLimit = 3;
      for (let i = 0; i < batches.length; i += concurrencyLimit) {
        const chunk = batches.slice(i, i + concurrencyLimit);

        const results = await Promise.allSettled(chunk.map(async (batch) => {
          const res = await fetch('/api/admin/lessons/seed-starter', {
            method: 'POST',
            headers,
            body: JSON.stringify({ topic_ids: batch }),
          });

          const responseText = await res.text();
          const payload = responseText ? (() => {
            try {
              return JSON.parse(responseText);
            } catch {
              return {};
            }
          })() : {};
          if (!res.ok) throw new Error(payload.error || responseText || `Request failed with status ${res.status}`);

          return {
            inserted: Number(payload.summary?.insertedLessons ?? 0),
            skipped: Number(payload.summary?.skippedLessons ?? 0)
          };
        }));

        const errors = [];
        for (const result of results) {
          if (result.status === 'fulfilled') {
            inserted += result.value.inserted;
            skipped += result.value.skipped;
          } else {
            errors.push(result.reason);
          }
        }

        if (errors.length > 0) {
          throw new Error(`Encountered ${errors.length} errors during batch processing. First error: ${errors[0].message || errors[0]}`);
        }
      }

      toast.success(`Generated ${inserted} starter lessons. Skipped ${skipped} existing topics.`);

      const cloudLessons = await fetchSupabaseLessons();
      setCurriculumTopicRows(await fetchSupabaseTopics());
      await hydrateLessonCache(cloudLessons);
      setTopicFallbackRows([]);
      cloudHydrationKeyRef.current = classroomScopeKey;
      await db.modules.update(module.id, { strictRAG: false });
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to generate starter lessons: ${err.message}`);
    } finally {
      setIsGeneratingStarterLessons(false);
    }
  };

  const handleAuditClassroom = async () => {
    if (!module) return;
    
    toast.promise(
      aiCrew.addTask('classroom_audit', {
        moduleName: module.name,
        country: currentCountry,
        grade: currentGrade,
        subject: module.category,
        existingLessons: lessons.map(l => ({ title: l.title, content: l.content }))
      }),
      {
        loading: 'Delegating audit to AI Crew...',
        success: 'Audit task added to queue!',
        error: 'Failed to delegate audit.'
      }
    );
  };

  if (module === undefined) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      </Layout>
    );
  }

  if (module === null) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <BookOpen className="w-12 h-12 text-slate-500/20" />
          <p className="text-slate-950 font-medium">{t('classroom_not_found')}</p>
          <button onClick={() => navigate('/dashboard')} className="text-accent hover:underline">{t('return_to_dashboard')}</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout fullWidth>
      <SEO title={module.name || "Classroom"} />
      <div className="h-full w-full bg-background flex flex-col overflow-hidden p-4">
        
        {/* Symmetrical Layout Container */}
        <div className="flex-grow min-h-0 w-full flex flex-col lg:flex-row gap-4 overflow-hidden">
          
          {/* Column 2: Main Classroom Content (Middle Column, flex-grow) */}
          <div className="flex-grow flex flex-col min-h-0 w-full overflow-hidden bg-white dark:bg-paper rounded-3xl shadow-lg border border-slate-200 dark:border-white/8 p-6">
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-6">
              
              {/* Page Header */}
              <div className="border-b border-slate-100 dark:border-white/5 pb-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/modules')}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-accent hover:text-white dark:bg-surface-low dark:hover:bg-accent text-slate-600 dark:text-ink-secondary transition-all shadow-sm shrink-0 cursor-pointer"
                    title="Back to Classrooms"
                  >
                    <ArrowLeft size={16} className="stroke-[2.5]" />
                  </button>
                  <div>
                    <h1 className="ls-page-title text-slate-950 dark:text-ink">{module.name}</h1>
                    {module.category && (
                      <p className="text-xs font-bold text-slate-400 dark:text-ink-muted uppercase tracking-normal mt-0.5">{module.category}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Layout Mode Toggle */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-surface-low rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setLayoutMode('grid')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                        layoutMode === 'grid'
                          ? 'bg-white dark:bg-paper text-slate-800 dark:text-ink shadow-sm'
                          : 'text-slate-500 dark:text-ink-muted hover:text-slate-700 dark:hover:text-ink'
                      }`}
                      title="Grid view"
                    >
                      <LayoutGrid size={13} />
                      Grid
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayoutMode('carousel')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                        layoutMode === 'carousel'
                          ? 'bg-white dark:bg-paper text-slate-800 dark:text-ink shadow-sm'
                          : 'text-slate-500 dark:text-ink-muted hover:text-slate-700 dark:hover:text-ink'
                      }`}
                      title="Carousel view"
                    >
                      <Rows3 size={13} />
                      Slide
                    </button>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={handleAuditClassroom}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1.5 border border-accent/20 px-3 py-1.5 rounded-xl hover:bg-accent/5 transition-all shadow-sm shrink-0"
                    >
                      <ShieldCheck size={14} /> Audit Curriculum
                    </button>
                  )}
                </div>
              </div>

              {isHydratingSupabase && !hasLessons && !hasTopicFallback && (
                <div className="bg-slate-50/50 border border-slate-200 rounded-3xl p-6 flex items-center gap-3 ls-body-text shrink-0">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  Checking Supabase for existing lessons, topics, and outlines...
                </div>
              )}

              {showSetupState ? (
                <div className="bg-slate-50/50 border border-solid border-slate-200 rounded-3xl p-10 md:p-14 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <BookOpen size={24} className="text-accent" />
                  </div>
                  <div className="space-y-2 max-w-md">
                    <p className="text-2xl font-bold text-slate-950">{t('start_here') || 'Set up this classroom'}</p>
                    <p className="ls-body-text">{t('start_here_desc') || 'Generate draft AI content, or load officially validated module titles.'}</p>
                  </div>
                  {!aiAvailable && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 w-full max-w-md">
                      <p className="text-xs text-amber-800 font-medium">{t('ai_key_needed') || 'AI features need an API key, but you can still load certified module titles right now.'}</p>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mt-4">
                    {aiAvailable && (
                      <button
                        onClick={() => handleGenerateLesson()}
                        disabled={!!generatingTitle}
                        className="flex-1 flex items-center justify-center gap-2 bg-accent text-white px-4 py-3.5 rounded-xl text-sm font-bold shadow-sm shadow-accent/20 hover:bg-accent/90 transition-all disabled:opacity-50"
                      >
                        {generatingTitle === module.name ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {t('generate_first_lesson') || 'Generate First Lesson'}
                      </button>
                    )}
                    <button
                      onClick={handleSeedFromSupabase}
                      disabled={isSeeding}
                      className="flex-1 flex items-center justify-center gap-2 bg-white text-slate-950 px-4 py-3.5 rounded-xl text-sm font-bold border border-slate-200 hover:border-accent/30 hover:text-accent transition-all disabled:opacity-50"
                    >
                      {isSeeding ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                      {isSeeding ? t('loading') || 'Loading...' : t('load_from_supabase') || 'Load from Supabase'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Tabs */}
                  {showTabs && (
                    <div className="flex gap-1 border-b border-slate-200 dark:border-white/8 -mb-px shrink-0">
                      {(['lessons', 'quizzes', 'exercises'] as const).map((tabKey) => {
                        const tabConfig = CLASSROOM_TAB_CONFIG[tabKey];
                        const TabIcon = tabConfig.icon;
                        const isActive = activeTab === tabKey;
                        return (
                          <button
                            key={tabKey}
                            onClick={() => setActiveTab(tabKey)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                              isActive
                                ? 'border-accent text-accent'
                                : 'border-transparent text-slate-500 dark:text-ink-muted hover:text-slate-950 dark:hover:text-ink'
                            }`}
                          >
                            <TabIcon size={14} />
                            {tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Tab Content */}
                  {activeTab === 'lessons' && (
                    <div className="space-y-4">
                      {showValidationWarningBanner && (
                        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 shrink-0">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                            <div>
                              <p className="text-sm font-semibold">Draft AI-assisted content is shown because no teacher-reviewed or officially validated lesson is available yet.</p>
                              <p className="mt-1 text-sm text-amber-800">Use the status badge on each module title before treating it as final Moroccan curriculum truth.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {!isAdmin && hasLessons && studentVisibleLessons.length === 0 && (
                        <div className="rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-blue-900 shadow-sm shrink-0">
                          <div className="flex items-start gap-3">
                            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                            <div>
                              <p className="text-sm font-semibold">Lessons are prepared but waiting for validation.</p>
                              <p className="mt-1 text-sm text-blue-800">Your teacher or administrator can review and publish them for classroom access.</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between shrink-0">
                        <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2 dark:text-ink">
                          <BookOpen size={20} className="text-accent" />
                          {hasTopicFallback ? t('curriculum_topics') : t('curriculum_units')}
                        </h3>
                        {lessons.length > 0 && suggestions.length === 0 && (
                          <button
                            onClick={fetchGallery}
                            disabled={isFetchingGallery || !aiAvailable}
                            title={!aiAvailable ? "AI features need an API key, but your classroom content is available." : ""}
                            className="text-xs font-medium text-blue-700 hover:underline flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isFetchingGallery ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                            Fetch Lesson Gallery
                          </button>
                        )}
                      </div>

                      {showDomainTabs && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-2 dark:bg-paper dark:border-white/8 shrink-0">
                          <div className="flex gap-2 overflow-x-auto no-scrollbar">
                            <button
                              onClick={() => setActiveDomainKey('all')}
                              className={`shrink-0 rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                                activeDomainKey === 'all'
                                  ? 'bg-accent text-white shadow-sm'
                                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950 dark:hover:bg-surface-low dark:text-ink-muted'
                              }`}
                            >
                              {t('all')}
                            </button>
                            {lessonDomainStats.map((domain) => (
                              <button
                                key={domain.key}
                                onClick={() => setActiveDomainKey(domain.key)}
                                className={`shrink-0 rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                                  activeDomainKey === domain.key
                                    ? 'bg-accent text-white shadow-sm'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950 dark:hover:bg-surface-low dark:text-ink-muted'
                                }`}
                              >
                                {domain.name}
                                {hasLessons && <span className="ml-1 opacity-70">{domain.count}</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Lesson Cards -- conditional layout */}
                      {layoutMode === 'carousel' ? (
                        // CAROUSEL MODE
                        <div className="pb-6">
                          {Array.isArray(lessons) && lessons.length > 0 ? (
                            visibleLessons.length > 0 ? (
                              <HorizontalSlider>
                                {visibleLessons.map((lesson, i) => {
                                  const isClickable = isAdmin || isStudentVisibleLesson(lesson);
                                  return (
                                    <motion.div
                                      key={lesson.id}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: i * 0.05 }}
                                      onClick={() => { if (isClickable) navigate(`/lesson/${lesson.id}`); }}
                                      className={`bg-white border border-slate-200 rounded-3xl overflow-hidden flex flex-col group transition-all dark:bg-paper dark:border-white/8 shadow-sm ${
                                        isClickable
                                          ? 'cursor-pointer hover:border-accent/30 hover:shadow-lg'
                                          : 'opacity-85 cursor-not-allowed'
                                      }`}
                                      style={{ width: '280px', minWidth: '280px', boxShadow: 'var(--ls-shadow)' }}
                                    >
                                      <div className={`px-5 py-3.5 flex items-center gap-2 text-white shrink-0 ${
                                        isClickable ? 'bg-[#007A87] dark:bg-accent' : 'bg-slate-500 dark:bg-slate-700'
                                      }`}>
                                        <BookOpen className="w-4 h-4 shrink-0 text-white" />
                                        <h3 className="text-sm font-bold leading-tight truncate text-white" title={lesson.title}>{lesson.title}</h3>
                                      </div>
                                      <div className="h-24 w-full overflow-hidden relative border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-surface-low shrink-0">
                                        <img
                                          src={lesson.bannerImage || getLessonIllustration(lesson.title, lesson.subject || module?.name)}
                                          alt={lesson.title}
                                          className={`w-full h-full object-cover transition-transform duration-700 ${isClickable ? 'group-hover:scale-105' : ''}`}
                                        />
                                      </div>
                                      <div className="p-4 flex-1 flex flex-col space-y-3">
                                        <div className="space-y-1">
                                          <div className="flex justify-between text-[11px] font-bold">
                                            <span className="text-slate-400 dark:text-ink-muted">Progress</span>
                                            <span className="text-slate-800 dark:text-ink">{lesson.status === 'done' ? '100%' : '0%'}</span>
                                          </div>
                                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-surface-mid">
                                            <div
                                              className={`h-full rounded-full ${lesson.status === 'done' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-surface-high'}`}
                                              style={{ width: lesson.status === 'done' ? '100%' : '0%' }}
                                            />
                                          </div>
                                        </div>
                                        {isClickable && (
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); navigate(`/lesson/${lesson.id}`); }}
                                            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white transition-colors shadow-sm mt-auto"
                                          >
                                            <Play className="w-3 h-3 fill-current text-white" />
                                            {lesson.status === 'done' ? 'Review' : 'Start Lesson'}
                                          </button>
                                        )}
                                      </div>
                                    </motion.div>
                                  );
                                })}
                              </HorizontalSlider>
                            ) : (
                              <div className="rounded-2xl border border-solid border-slate-200 bg-white p-5 dark:border-white/8 dark:bg-paper">
                                <p className="text-sm font-semibold text-slate-950 dark:text-ink">No lessons in this domain yet.</p>
                              </div>
                            )
                          ) : hasTopicFallback ? (
                            <HorizontalSlider>
                              {visibleTopicFallbackRows.map((topic, i) => (
                                <motion.div
                                  key={topic.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.03 }}
                                  onClick={() => handleGenerateLesson(topic.title, true)}
                                  className="bg-white border border-slate-200 rounded-3xl overflow-hidden flex flex-col group hover:border-accent/30 hover:shadow-lg transition-all dark:bg-paper dark:border-white/8 shadow-sm cursor-pointer"
                                  style={{ width: '240px', minWidth: '240px' }}
                                >
                                  <div className="bg-[#007A87] px-4 py-3 flex items-center gap-2 text-white dark:bg-accent shrink-0">
                                    <BookOpen className="w-4 h-4 shrink-0 text-white" />
                                    <h3 className="text-sm font-bold truncate text-white" title={topic.title}>{topic.title}</h3>
                                  </div>
                                  <div className="h-20 w-full overflow-hidden border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-surface-low shrink-0">
                                    <img
                                      src={getLessonIllustration(topic.title, module?.name)}
                                      alt={topic.title}
                                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                  </div>
                                  <div className="p-3 flex-1 flex flex-col">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleGenerateLesson(topic.title, true); }}
                                      className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-accent hover:bg-accent/90 px-3 py-2 text-xs font-bold text-white transition-colors shadow-sm"
                                    >
                                      <Sparkles className="w-3 h-3" />
                                      Generate Lesson
                                    </button>
                                  </div>
                                </motion.div>
                              ))}
                            </HorizontalSlider>
                          ) : null}
                        </div>
                      ) : (
                        // GRID MODE
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6">
                        {Array.isArray(lessons) && lessons.length > 0 ? (
                          visibleLessons.length > 0 ? visibleLessons.map((lesson, i) => {
                            const isClickable = isAdmin || isStudentVisibleLesson(lesson);
                            const availabilityState = getLessonAvailabilityState(lesson);
                            
                            return (
                              <motion.div 
                                key={lesson.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={(e) => {
                                  const target = e.target as HTMLElement;
                                  if (!target.isConnected || !document.body.contains(target)) return;

                                  if (target.closest('.practice-test-metrics-trigger')) {
                                    e.stopPropagation();
                                    const quizzes = (lesson.blocks || []).filter((b: any) => b.purpose === 'quiz' || b.type === 'quiz');
                                    const exercises = (lesson.blocks || []).filter((b: any) => b.purpose === 'practice' || b.purpose === 'exam' || b.type === 'practice' || b.type === 'exam');
                                    const hasTests = quizzes.length > 0 || exercises.length > 0;
                                    if (hasTests) {
                                      navigate(`/lesson/${lesson.id}`, { state: { startAtTest: true } });
                                    } else {
                                      navigate(`/lesson/${lesson.id}`);
                                    }
                                    return;
                                  }

                                  if (target.closest('.card-footer-actions') || target.closest('button')) return;
                                  if (isClickable) navigate(`/lesson/${lesson.id}`);
                                }}
                                className={`bg-white border border-slate-200 rounded-3xl overflow-hidden flex flex-col group transition-all dark:bg-paper dark:border-white/8 shadow-sm ${
                                  isClickable 
                                    ? 'cursor-pointer hover:border-accent/30 hover:shadow-lg' 
                                    : 'opacity-85 bg-slate-50/50 dark:bg-surface-low/50 cursor-not-allowed'
                                }`}
                                style={{ boxShadow: 'var(--ls-shadow)' }}
                              >
                                {/* Top Redesigned Teal Header Bar */}
                                <div className={`px-5 py-3.5 flex items-center justify-between text-white shrink-0 ${
                                  isClickable ? 'bg-[#007A87] dark:bg-accent' : 'bg-slate-500 dark:bg-slate-700'
                                }`}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <BookOpen className="w-4 h-4 shrink-0 text-white" />
                                    <h3 className="text-sm font-bold leading-tight truncate text-white dark:text-white" title={lesson.title}>{lesson.title}</h3>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 ml-2">
                                    {module?.category && (
                                      <span className="bg-white/15 text-white text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm truncate max-w-[90px]">{module.category}</span>
                                    )}
                                    {(lesson.grade || currentGrade) && (
                                      <span className="bg-white/15 text-white text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm truncate max-w-[80px]">{lesson.grade || currentGrade}</span>
                                    )}
                                  </div>
                                </div>

                                {/* Horizontal Dynamic Illustration Banner */}
                                <div className="h-24 w-full overflow-hidden relative border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-surface-low shrink-0">
                                  <img 
                                    src={lesson.bannerImage || getLessonIllustration(lesson.title, lesson.subject || module?.name)}
                                    alt={lesson.title}
                                    className={`w-full h-full object-cover transition-transform duration-700 ${isClickable ? 'group-hover:scale-105' : ''}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); togglePinLesson(lesson.id); }}
                                    className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center border backdrop-blur-md transition-all shadow-sm cursor-pointer ${
                                      pinnedLessonIds.includes(lesson.id)
                                        ? 'bg-amber-500 border-amber-400 text-white shadow-amber-500/40 shadow-md'
                                        : 'bg-black/35 border-white/20 text-white/75 hover:text-white hover:bg-black/50'
                                    }`}
                                    title={pinnedLessonIds.includes(lesson.id) ? 'Unpin Lesson' : 'Pin to Study Desk'}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill={pinnedLessonIds.includes(lesson.id) ? "currentColor" : "none"}
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
                                </div>

                                {/* Card Body */}
                                <div className="p-5 flex-1 flex flex-col space-y-4">
                                  <div className="grid grid-cols-2 gap-4 text-sm border-b border-slate-100 pb-4 dark:border-white/6 items-center">
                                    {(() => {
                                      const quizzes = (lesson.blocks || []).filter((b: any) => b.purpose === 'quiz' || b.type === 'quiz');
                                      const exercises = (lesson.blocks || []).filter((b: any) => b.purpose === 'practice' || b.purpose === 'exam' || b.type === 'practice' || b.type === 'exam');
                                      const hasTests = quizzes.length > 0 || exercises.length > 0;
                                      return (
                                        <div className="space-y-1 practice-test-metrics-trigger cursor-pointer hover:bg-slate-50 dark:hover:bg-surface-low rounded-xl p-1.5 transition-all" title={hasTests ? "Click to take practice test directly" : ""}>
                                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-ink">
                                            <Target className="w-3.5 h-3.5 text-accent shrink-0" />
                                            <span>Practice Test</span>
                                          </div>
                                          <p className="text-[10px] text-slate-500 dark:text-ink-muted leading-tight">
                                            {hasTests 
                                              ? `${quizzes.length} Quizzes • ${exercises.length} Exercises`
                                              : 'No tests generated yet'}
                                          </p>
                                        </div>
                                      );
                                    })()}
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-[11px] font-bold">
                                        <span className="text-slate-400 dark:text-ink-muted">Progress</span>
                                        <span className="text-slate-800 dark:text-ink">{lesson.status === 'done' ? '100%' : '0%'}</span>
                                      </div>
                                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-surface-mid">
                                        <div 
                                          className={`h-full rounded-full ${lesson.status === 'done' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-surface-high'}`} 
                                          style={{ width: lesson.status === 'done' ? '100%' : '0%' }} 
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-ink-muted">
                                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                    <span>
                                      Last Active: {lesson.createdAt ? relativeTime(lesson.createdAt) : 'No activity yet'}
                                    </span>
                                  </div>

                                  <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-white/6">
                                    {isClickable ? (
                                      <div className="flex items-center gap-2 card-footer-actions">
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); navigate(`/lesson/${lesson.id}`); }}
                                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white transition-colors shadow-sm"
                                        >
                                          <Play className="w-3 h-3 fill-current text-white" />
                                          {lesson.status === 'done' ? 'Review' : 'Start Lesson'}
                                        </button>
                                        {(() => {
                                          const quizzes = (lesson.blocks || []).filter((b: any) => b.purpose === 'quiz' || b.type === 'quiz');
                                          const exercises = (lesson.blocks || []).filter((b: any) => b.purpose === 'practice' || b.purpose === 'exam' || b.type === 'practice' || b.type === 'exam');
                                          const hasTests = quizzes.length > 0 || exercises.length > 0;
                                          if (hasTests) {
                                            return (
                                              <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); navigate(`/lesson/${lesson.id}`, { state: { startAtTest: true } }); }}
                                                className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors dark:border-white/10 dark:bg-paper dark:text-ink-secondary dark:hover:bg-surface-low flex items-center gap-1.5 shadow-sm"
                                              >
                                                <Target size={12} className="text-accent shrink-0" />
                                                Take Test
                                              </button>
                                            );
                                          }
                                          return (
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); navigate(`/lesson/${lesson.id}`); }}
                                              className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors dark:border-white/10 dark:bg-paper dark:text-ink-secondary dark:hover:bg-surface-low"
                                            >
                                              View Plan
                                            </button>
                                          );
                                        })()}
                                      </div>
                                    ) : (
                                      <div className="flex-1 text-[11px] text-slate-500 dark:text-ink-muted font-medium pr-2 leading-relaxed">
                                        {availabilityState === 'needs_review' 
                                          ? 'Lesson exists but is waiting for review' 
                                          : 'Starter lesson available for admin review'}
                                      </div>
                                    )}

                                    {isClickable ? (
                                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                                        lesson.status === 'done' ? 'text-emerald-700 dark:text-emerald-400' : 'text-accent'
                                      }`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${lesson.status === 'done' ? 'bg-emerald-500 animate-pulse' : 'bg-accent'}`} />
                                        {lesson.status === 'done' ? 'Completed' : 'Available'}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                        {availabilityState === 'needs_review' ? 'Under Review' : 'Draft'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          }) : (
                            <div className="col-span-full rounded-2xl border border-solid border-slate-200 bg-white p-5 dark:border-white/8 dark:bg-paper">
                              <p className="text-sm font-semibold text-slate-950 dark:text-ink">No lessons in this domain yet.</p>
                              <p className="mt-1 ls-micro-label">Switch back to {t('all')} to see every available lesson for this classroom.</p>
                            </div>
                          )
                        ) : hasTopicFallback ? (
                          visibleTopicFallbackRows.map((topic, i) => (
                            <motion.div
                              key={topic.id}
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.03 }}
                              onClick={(e) => {
                                const target = e.target as HTMLElement;
                                if (!target.isConnected || !document.body.contains(target)) return;
                                if (target.closest('.card-footer-actions') || target.closest('button')) return;
                                handleGenerateLesson(topic.title, true);
                              }}
                              className="bg-white border border-slate-200 rounded-3xl overflow-hidden flex flex-col group hover:border-accent/30 hover:shadow-lg transition-all dark:bg-paper dark:border-white/8 shadow-sm cursor-pointer"
                              style={{ boxShadow: 'var(--ls-shadow)' }}
                            >
                              {/* Top Redesigned Teal Header Bar */}
                              <div className="bg-[#007A87] px-5 py-3.5 flex items-center justify-between text-white dark:bg-accent shrink-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <BookOpen className="w-4 h-4 shrink-0 text-white" />
                                  <h3 className="text-sm font-bold leading-tight truncate text-white dark:text-white" title={topic.title}>{topic.title}</h3>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  {module?.category && (
                                    <span className="bg-white/15 text-white text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm truncate max-w-[90px]">{module.category}</span>
                                  )}
                                  {currentGrade && (
                                    <span className="bg-white/15 text-white text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm truncate max-w-[80px]">{currentGrade}</span>
                                  )}
                                </div>
                              </div>

                              {/* Horizontal Dynamic Illustration Banner */}
                              <div className="h-24 w-full overflow-hidden relative border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-surface-low shrink-0">
                                <img 
                                  src={getLessonIllustration(topic.title, module?.name)}
                                  alt={topic.title}
                                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                              </div>

                              {/* Card Body */}
                              <div className="p-5 flex-1 flex flex-col space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm border-b border-slate-100 pb-4 dark:border-white/6 items-center">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-ink">
                                      <Target className="w-3.5 h-3.5 text-slate-400 dark:text-ink-muted shrink-0" />
                                      <span>Practice Test</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-ink-muted leading-tight">
                                      No tests generated yet
                                    </p>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-[11px] font-bold">
                                      <span className="text-slate-400 dark:text-ink-muted">Progress</span>
                                      <span className="text-slate-800 dark:text-ink">0%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-surface-mid">
                                      <div 
                                        className="h-full rounded-full bg-slate-300 dark:bg-surface-high" 
                                        style={{ width: '0%' }} 
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-ink-muted">
                                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                  <span>
                                    Last Active: No activity yet
                                  </span>
                                </div>

                                <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-white/6">
                                  <div className="flex items-center gap-2 card-footer-actions">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleGenerateLesson(topic.title, true); }}
                                      disabled={!!generatingTitle}
                                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white transition-colors shadow-sm disabled:opacity-60"
                                    >
                                      {generatingTitle === topic.title ? (
                                        <Loader2 size={12} className="animate-spin text-white" />
                                      ) : (
                                        <Play className="w-3 h-3 fill-current text-white" />
                                      )}
                                      Generate
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleGenerateLesson(topic.title, true); }}
                                      className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors dark:border-white/10 dark:bg-paper dark:text-ink-secondary dark:hover:bg-surface-low"
                                    >
                                      View Plan
                                    </button>
                                  </div>

                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                    Not Started
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          ))
                        ) : null}
                      </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'quizzes' && (
                <div className="space-y-4 pb-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2 dark:text-ink shrink-0">
                      <Target size={20} className="text-accent" />
                      {t('available_quizzes')}
                    </h3>
                  </div>
                  {isLoadingExtra ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-accent" /></div>
                  ) : quizzes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {quizzes.map((quiz) => (
                        <div 
                          key={quiz.id} 
                          onClick={() => navigate(`/lesson/${quiz.lesson_id}`, { state: { startAtTest: true } })}
                          className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-accent/30 transition-all cursor-pointer hover:shadow-md dark:bg-paper dark:border-white/8 shadow-sm"
                        >
                          <h4 className="font-bold text-slate-950 dark:text-ink">{quiz.title}</h4>
                          <p className="ls-body-text mt-1">{quiz.description}</p>
                          <div className="flex items-center gap-3 mt-4">
                            <span className="text-xs font-medium bg-slate-50 dark:bg-surface-low px-2 py-1 rounded text-slate-500 dark:text-ink-muted">{quiz.difficulty}</span>
                            <span className="text-xs font-medium bg-slate-50 dark:bg-surface-low px-2 py-1 rounded text-slate-500 dark:text-ink-muted">{quiz.questions?.length || 0} Questions</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50/50 border border-solid border-slate-200 rounded-3xl p-16 text-center dark:bg-surface-low/10 dark:border-white/5">
                      <p className="text-slate-500 dark:text-ink-muted">{t('no_quizzes_for_lessons')}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'exercises' && (
                <div className="space-y-4 pb-6">
                  <div className="flex items-center justify-between text-slate-950 dark:text-ink">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Dumbbell size={20} className="text-accent" />
                      {t('practice_exercises')}
                    </h3>
                  </div>
                  {isLoadingExtra ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-accent" /></div>
                  ) : exercises.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {exercises.map((exercise) => (
                        <div 
                          key={exercise.id} 
                          onClick={() => navigate(`/lesson/${exercise.lesson_id}`, { state: { startAtTest: true } })}
                          className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-accent/30 transition-all cursor-pointer hover:shadow-md dark:bg-paper dark:border-white/8 shadow-sm"
                        >
                          <h4 className="font-bold text-slate-950 dark:text-ink">{exercise.title}</h4>
                          <p className="ls-body-text mt-1 line-clamp-2">{exercise.prompt}</p>
                          <div className="flex items-center gap-3 mt-4">
                            <span className="text-xs font-medium bg-slate-50 dark:bg-surface-low px-2 py-1 rounded text-slate-500 dark:text-ink-muted">{exercise.difficulty}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50/50 border border-solid border-slate-200 rounded-3xl p-16 text-center dark:bg-surface-low/10 dark:border-white/5">
                      <p className="text-slate-500 dark:text-ink-muted">{t('no_exercises_for_lessons')}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Gallery Section */}
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pt-8 border-t border-slate-200 dark:border-white/8 shrink-0"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-950 dark:text-ink flex items-center gap-2">
                        <Sparkles size={20} className="text-accent" />
                        Suggested Module Titles
                      </h3>
                      <div className="flex items-center gap-4">
                        {selectedSuggestions.length > 0 ? (
                          <button 
                            onClick={handleCurateSelected}
                            disabled={!!generatingTitle}
                            className="text-xs font-medium text-blue-700 hover:underline disabled:opacity-50 dark:text-accent"
                          >
                            {generatingTitle === 'selected' ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}
                            Curate Selected ({selectedSuggestions.length})
                          </button>
                        ) : (
                          <button 
                            onClick={handleCurateAll}
                            disabled={!!generatingTitle}
                            className="text-xs font-medium text-blue-700 hover:underline disabled:opacity-50 dark:text-accent"
                          >
                            {generatingTitle === 'all' ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}
                            Curate All
                          </button>
                        )}
                        <button 
                          onClick={() => setSuggestions([])}
                          className="ls-micro-label hover:text-slate-950 dark:hover:text-ink"
                        >
                          Close Gallery
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6">
                      {Array.isArray(suggestions) && suggestions.map((suggestion, i) => {
                        const isSelected = selectedSuggestions.includes(suggestion.title);
                        const isThisGenerating = generatingTitle === suggestion.title;
                        const anyGenerating = !!generatingTitle;

                        return (
                          <motion.div 
                            key={i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => {
                              if (anyGenerating) return;
                              setSelectedSuggestions(prev => 
                                prev.includes(suggestion.title) 
                                  ? prev.filter(t => t !== suggestion.title) 
                                  : [...prev, suggestion.title]
                              );
                            }}
                            className={`bg-white border p-6 rounded-2xl space-y-4 transition-all group cursor-pointer relative dark:bg-paper ${
                              isSelected ? 'border-accent ring-1 ring-accent/20 bg-accent/[0.02]' : 'border-slate-200 hover:border-accent/30 dark:border-white/8'
                            } ${anyGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isSelected && (
                              <div className="absolute top-4 right-4 text-accent">
                                <CheckCircle2 size={16} />
                              </div>
                            )}
                            <div className="space-y-1">
                              <h4 className={`text-base font-bold transition-colors ${isSelected ? 'text-accent' : 'text-slate-950 dark:text-ink group-hover:text-accent'}`}>
                                {suggestion.title}
                              </h4>
                              <p className="ls-micro-label leading-relaxed">{suggestion.description}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGenerateLesson(suggestion.title);
                                }}
                                disabled={anyGenerating}
                                className="flex items-center gap-2 text-xs font-medium text-blue-700 hover:underline disabled:opacity-50 dark:text-accent"
                              >
                                {isThisGenerating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                                Curate
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGenerateLesson(suggestion.title, true);
                                }}
                                disabled={anyGenerating}
                                className="flex items-center gap-2 text-xs font-medium text-slate-950 dark:text-ink hover:underline disabled:opacity-50"
                              >
                                {isThisGenerating ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                                Curate & Launch
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>

          {/* Column 3: Classroom Widgets Sidebar (Right Column, 260px width) */}
          <div className="hidden lg:flex lg:w-[260px] w-full shrink-0 h-full bg-white dark:bg-paper rounded-3xl shadow-lg border border-slate-200 dark:border-white/8 overflow-hidden flex-col p-5">
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-6 pr-1">
              
              {/* Subject Telemetry Card */}
              <section className="bg-slate-950 text-white rounded-2xl p-5 relative overflow-hidden group dark:bg-surface-low dark:text-ink shrink-0">
                <div className="relative z-10 flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider dark:text-ink-muted">Telemetry</h3>
                    <h4 className="text-sm font-bold text-white mt-1 dark:text-ink truncate max-w-[140px]" title={module.name}>{module.name} Status</h4>
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-emerald-500/30 text-emerald-400 flex items-center justify-center bg-emerald-500/10">
                    <Activity size={18} />
                  </div>
                </div>
                
                <div className="relative z-10 space-y-4">
                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400 dark:text-ink-muted">Syllabus Progress</span>
                      <span className="text-white dark:text-ink">
                        {lessons.length > 0 ? Math.round((lessons.filter(l => l.status === 'done').length / lessons.length) * 100) : (module.progress || 0)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden dark:bg-surface-mid">
                      <div 
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500" 
                        style={{ 
                          width: `${lessons.length > 0 ? Math.round((lessons.filter(l => l.status === 'done').length / lessons.length) * 100) : (module.progress || 0)}%` 
                        }} 
                      />
                    </div>
                  </div>

                  {/* Telemetry stats grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-800 pt-3 dark:border-white/5">
                    <div>
                      <p className="text-slate-500 dark:text-ink-muted font-medium">Completed</p>
                      <p className="text-base font-bold text-white dark:text-ink mt-0.5">
                        {lessons.filter(l => l.status === 'done').length} / {lessons.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-ink-muted font-medium">Total Tests</p>
                      <p className="text-base font-bold text-white dark:text-ink mt-0.5">
                        {quizzes.length + exercises.length}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Focus Timer Card */}
              <section className="bg-slate-950 text-white rounded-2xl p-5 relative overflow-hidden group dark:bg-surface-low dark:text-ink shrink-0">
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider dark:text-ink-muted">{t('deep_focus') || 'Deep Focus'}</h3>
                    <div className="text-3xl font-bold tracking-tight mt-1 mb-3">
                      {formatTime(timerSeconds)}
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center ${isTimerRunning ? 'border-accent text-accent animate-pulse' : 'border-slate-800 text-slate-600 dark:border-slate-200 dark:text-slate-400'}`}>
                    <Timer size={20} />
                  </div>
                </div>
                <div className="relative z-10 flex gap-2">
                  <button
                    onClick={() => setIsTimerRunning(!isTimerRunning)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isTimerRunning
                        ? 'bg-slate-800 text-white hover:bg-slate-700 dark:bg-surface-mid dark:text-ink'
                        : 'bg-accent text-white hover:bg-accent/90'
                    }`}
                  >
                    {isTimerRunning ? (t('pause') || 'Pause') : (t('dashboard_start') || 'Start Timer')}
                  </button>
                  <button
                    onClick={() => { setIsTimerRunning(false); setTimerSeconds(defaultDuration * 60); }}
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
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider dark:text-ink-muted">Support Zone</h3>
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-accent/30 text-accent flex items-center justify-center bg-accent/10">
                    <Activity size={18} />
                  </div>
                </div>
                <div className="relative z-10 space-y-4">
                  <p className="text-sm font-medium text-slate-300 dark:text-ink-secondary leading-relaxed text-xs">
                    Check your real level, discover your gaps, and get a personal roadmap.
                  </p>
                  <button
                    onClick={() => setIsSupportModalOpen(true)}
                    className="w-full py-2.5 rounded-xl text-xs font-bold transition-all bg-accent text-white hover:bg-accent/90"
                  >
                    Start MyLevel Check
                  </button>
                </div>
              </section>

              {/* Classroom Activity Log Card */}
              <section className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5 shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-950 dark:text-ink uppercase tracking-wider">{t('activity_log') || 'Activity Log'}</h3>
                  <span className="text-[9px] bg-slate-50 dark:bg-surface-low border border-slate-100 dark:border-white/5 text-slate-400 dark:text-ink-muted px-2 py-0.5 rounded-full font-bold">LIVE</span>
                </div>
                
                <div className="space-y-3.5 max-h-[220px] overflow-y-auto no-scrollbar">
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

            </div>
          </div>
        </div>
      </div>

      {/* SupportZoneModal */}
      <SupportZoneModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        subject={module.name}
        grade={currentGrade}
      />
    </Layout>
  );
};
