import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Layout } from '../components/Layout';
import { ShieldCheck, AlertTriangle, ArrowLeft, BookOpen, Plus, ChevronRight, CheckCircle2, Clock, Brain, Sparkles, Loader2, Play, Target, Dumbbell, Database } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { supabase } from '../db/supabase';
import { TagsManager } from '../components/TagsManager';
import { generateSeedLesson, generateLessonSuggestions, LessonSuggestion, checkAIProvider } from '../services/geminiService';
import { aiCrew } from '../services/aiCrewService';
import { getQuizzesByLesson } from '../services/quizService';
import { getExercisesByLesson } from '../services/exerciseService';
import { filterStudentVisibleLessons } from '../services/lessonRecovery';
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

const normalizeLessonTitle = (title: string | null | undefined) =>
  String(title || '').trim().toLocaleLowerCase();

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

const resolveCurriculumIds = async (grade: string, subject: string, category?: string | null) => {
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

  return {
    gradeId: matchedGrade?.id ?? null,
    subjectId: matchedSubject?.id ?? null,
    subjectIds: Array.from(new Set([matchedSubject?.id, ...subjectIds].filter(Boolean) as string[])),
  };
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
  const aiAvailable = checkAIProvider();
  const [activeDomainKey, setActiveDomainKey] = useState<string>('all');

  const module = useLiveQuery(() => id ? db.modules.get(id) : undefined, [id]);
  const allLessons = useLiveQuery(() => id ? db.lessons.where('moduleId').equals(id).sortBy('createdAt') : [], [id]);
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const settingsMap = useMemo(() => Object.fromEntries(dbSettings.map(s => [s.key, s.value])), [dbSettings]);

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
        if (normalizedCurrentCountry && lessonCountry && lessonCountry !== normalizedCurrentCountry) {
          return false;
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
  const lessons = useMemo(
    () => (
      isAdmin
        ? storedLessons
        : (studentLessonSelection.hasPreferred
          ? studentLessonSelection.preferredOnly
          : studentLessonSelection.fallback)
    ),
    [isAdmin, storedLessons, studentLessonSelection],
  );
  const hasLessons = lessons.length > 0;
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
  const showTabs = hasLessons || hasTopicFallback || hasSupplementalContent || isLoadingExtra;
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
            topicLessonQuery = topicLessonQuery.eq('country', currentCountry);
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
        exactGradeQuery = exactGradeQuery.eq('country', currentCountry);
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
        fallbackQuery = fallbackQuery.eq('country', currentCountry);
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

    const existingById = new Map((allLessons || []).map((lesson) => [lesson.id, lesson]));
    const existingByTitle = new Map((allLessons || []).map((lesson) => [normalizeLessonTitle(lesson.title), lesson]));

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
        status: isStarterNeedsReview
          ? 'pending' as const
          : (hasStoredContent || normalizedStatus === 'published' || normalizedStatus === 'done' || normalizedStatus === 'draft')
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
    if (!module || !id || allLessons === undefined) return;
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
  }, [allLessons, classroomScopeKey, currentCountry, currentGrade, id, module, selectedBacTrack]);

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
    
    if (activeTab !== 'lessons') {
      fetchExtraData();
    }
  }, [activeTab, lessons]);

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
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-20">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-xs font-bold  text-slate-500 hover:text-slate-950 transition-colors"
            >
              <ArrowLeft size={14} />
              {t('back_to_dashboard')}
            </button>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="bg-accent/10 text-accent text-xs font-medium px-2 py-0.5 rounded ">{module.code}</span>
                <span className="text-slate-500 text-xs font-medium">{module.category}</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold font-display leading-[0.88] tracking-tight text-slate-950 editorial-title">{module.name}</h1>
              <p className="ls-body-text max-w-2xl leading-relaxed">{module.description}</p>
            </div>
          </div>

          {!showSetupState && (
            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              {isAdmin && (
                <button
                  onClick={handleSeedFromSupabase}
                  disabled={isSeeding}
                  className="flex items-center gap-2 bg-slate-50 text-slate-950 px-4 py-3 rounded-xl text-xs font-medium transition-all border border-slate-200 hover:border-accent/30 hover:text-accent disabled:opacity-50"
                >
                  {isSeeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                  {isSeeding ? 'Loading Units' : 'Load from Supabase'}
                </button>
              )}
              {aiAvailable ? (
                <>
                  {isAdmin && hasLessons && (
                    <button
                      onClick={handleAuditClassroom}
                      className="flex items-center gap-2 bg-slate-50 text-slate-500 hover:text-accent px-4 py-3 rounded-xl text-xs font-medium transition-all border border-slate-200"
                    >
                      <ShieldCheck size={14} />
                      Audit
                    </button>
                  )}
                  <button
                    onClick={() => handleGenerateLesson()}
                    disabled={!!generatingTitle}
                    className="flex items-center gap-2 bg-slate-950 text-white px-6 py-3 rounded-xl text-xs font-bold  hover:bg-accent transition-all shadow-sm shadow-ink/10 disabled:opacity-50"
                  >
                    {generatingTitle === module.name ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {hasLessons ? 'Generate Lesson' : 'Generate First Lesson'}
                  </button>
                </>
              ) : (
                <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-medium">
                  AI features need an API key
                </div>
              )}
            </div>
          )}
        </div>

        {/* Admin Controls */}
        {isAdmin && (
          <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-accent">Admin Controls</p>
                <p className="text-sm text-slate-950 font-medium">Keep this classroom grounded in certified content before using AI.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-slate-200">
                  <div>
                    <p className="ls-micro-label">Strict RAG</p>
                    <p className="text-[11px] text-slate-500">Use lesson context only</p>
                  </div>
                  <button
                    onClick={async () => {
                      await db.modules.update(module.id, { strictRAG: !module.strictRAG });
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative ${module.strictRAG ? 'bg-accent' : 'bg-slate-950/20'}`}
                  >
                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${module.strictRAG ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        {isHydratingSupabase && !hasLessons && !hasTopicFallback && (
          <div className="bg-slate-50/50 border border-slate-200 rounded-3xl p-6 flex items-center gap-3 ls-body-text">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            Checking Supabase for existing lessons, topics, and outlines...
          </div>
        )}

        {hasTopicFallback && (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-bold text-slate-950">{t('curriculum_topics') || 'Curriculum Topics'}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {topicFallbackRows.length} {t('topics_available') || 'topics found. Generate lessons to start learning.'}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={handleGenerateStarterLessons}
                  disabled={isGeneratingStarterLessons}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                >
                  {isGeneratingStarterLessons ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                  {isGeneratingStarterLessons ? t('generating') || 'Generating...' : t('generate_starter_lessons') || 'Generate All Lessons'}
                </button>
              )}
            </div>
          </div>
        )}

        {showStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="ls-card p-6 space-y-2">
              <p className="ls-micro-label">Progress</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-950">{module.progress}%</span>
                <span className="ls-micro-label">Complete</span>
              </div>
              <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${module.progress}%` }} />
              </div>
            </div>
            <div className="ls-card p-6 space-y-2">
              <p className="ls-micro-label">Lessons</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-950">{hasLessons ? lessons.length : topicFallbackRows.length}</span>
                <span className="ls-micro-label">{hasLessons ? 'Units Curated' : 'Topics need starter lessons'}</span>
              </div>
            </div>
          </div>
        )}

        {showSetupState ? (
          <div className="bg-slate-50/50 border border-solid border-slate-200 rounded-3xl p-10 md:p-14 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
              <BookOpen size={24} className="text-accent" />
            </div>
            <div className="space-y-2 max-w-md">
              <p className="text-2xl font-bold text-slate-950">{t('start_here') || 'Set up this classroom'}</p>
              <p className="ls-body-text">{t('start_here_desc') || 'Generate draft AI content, or load officially validated units.'}</p>
            </div>
            {!aiAvailable && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 w-full max-w-md">
                <p className="text-xs text-amber-800 font-medium">{t('ai_key_needed') || 'AI features need an API key, but you can still load certified units right now.'}</p>
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
              <div className="flex gap-2 border-b border-slate-200 overflow-x-auto pb-2">
                {(['lessons', 'quizzes', 'exercises'] as const).map((tabKey) => {
                  const tabConfig = CLASSROOM_TAB_CONFIG[tabKey];
                  const TabIcon = tabConfig.icon;
                  const isActive = activeTab === tabKey;
                  return (
                    <button
                      key={tabKey}
                      onClick={() => setActiveTab(tabKey)}
                      className={`flex items-center gap-2 rounded-t-2xl px-4 py-3 text-sm font-bold  transition-all border-b-2 whitespace-nowrap ${
                        isActive
                          ? tabConfig.activeClass
                          : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-950'
                      }`}
                    >
                      <TabIcon size={16} className={isActive ? tabConfig.iconClass : 'text-slate-500'} />
                      {t(tabKey)}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tab Content */}
            {activeTab === 'lessons' && (
              <div className="space-y-4">
                {showValidationWarningBanner && (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">Draft AI-assisted content is shown because no teacher-reviewed or officially validated lesson is available yet.</p>
                        <p className="mt-1 text-sm text-amber-800">Use the status badge on each unit before treating it as final Moroccan curriculum truth.</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
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
                  <div className="rounded-2xl border border-slate-200 bg-white p-2">
                    <div className="flex gap-2 overflow-x-auto">
                      <button
                        onClick={() => setActiveDomainKey('all')}
                        className={`shrink-0 rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                          activeDomainKey === 'all'
                            ? 'bg-accent text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'
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
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'
                          }`}
                        >
                          {domain.name}
                          {hasLessons && <span className="ml-1 opacity-70">{domain.count}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.isArray(lessons) && lessons.length > 0 ? (
                    visibleLessons.length > 0 ? visibleLessons.map((lesson, i) => (
                      <motion.div 
                        key={lesson.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col group hover:border-accent/30 hover:shadow-sm hover:shadow-ink/5 transition-all"
                      >
                        <div className="flex-1 cursor-pointer" onClick={() => navigate(`/lesson/${lesson.id}`)}>
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                                lesson.status === 'done' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400 group-hover:bg-accent/10 group-hover:text-accent'
                              }`}>
                                {lesson.status === 'done' ? <CheckCircle2 size={18} /> : <Play size={16} className="ml-0.5" />}
                              </div>
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Module {i + 1}</span>
                            </div>
                            
                            <h4 className="text-base font-bold text-slate-950 mb-2 line-clamp-2 group-hover:text-accent transition-colors" title={lesson.title}>{lesson.title}</h4>
                            
                            <div className="mt-2 flex flex-wrap gap-1 mb-4">
                              {lesson.tags?.slice(0, 3).map(tag => (
                                <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{tag}</span>
                              ))}
                            </div>
                        </div>

                        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide ${
                                lesson.status === 'done' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 bg-slate-50'
                            }`}>
                              {lesson.status === 'done' ? t('completed') || 'Completed' : t('draft') || 'Draft'}
                            </span>
                            <button
                              onClick={() => navigate(`/lesson/${lesson.id}`)}
                              className="text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-950 hover:text-white px-4 py-2 rounded-lg transition-all"
                            >
                              {t('view') || 'View'}
                            </button>
                        </div>
                      </motion.div>
                    )) : (
                      <div className="col-span-full rounded-2xl border border-solid border-slate-200 bg-white p-5">
                        <p className="text-sm font-semibold text-slate-950">No lessons in this domain yet.</p>
                        <p className="mt-1 ls-micro-label">Switch back to {t('all')} to see every available lesson for this classroom.</p>
                      </div>
                    )
                  ) : hasTopicFallback ? (
                    visibleTopicFallbackRows.map((topic, i) => (
                      <motion.div
                        key={topic.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col hover:border-accent/30 hover:shadow-sm transition-all"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center">
                              <BookOpen size={18} />
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Module {i + 1}</span>
                          </div>
                          
                          <h4 className="text-base font-bold text-slate-950 mb-2 line-clamp-2" title={topic.title}>{topic.title}</h4>
                          
                          {topic.outlines.length > 0 ? (
                            <p className="text-xs text-slate-500 line-clamp-2 mb-4">
                              {topic.outlines[0]?.description || topic.outlines[0]?.title}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 italic mb-4">No outline available</p>
                          )}
                        </div>
                        
                        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-md uppercase tracking-wide">
                            {t('not_started') || 'Not Started'}
                          </span>
                          <button
                            onClick={() => handleGenerateLesson(topic.title, true)}
                            disabled={!!generatingTitle}
                            className="text-xs font-bold text-accent bg-accent/10 hover:bg-accent hover:text-white px-4 py-2 rounded-lg transition-all"
                          >
                            {generatingTitle === topic.title ? <Loader2 size={14} className="animate-spin" /> : (t('generate') || 'Generate')}
                          </button>
                        </div>
                      </motion.div>
                    ))
                  ) : null}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'quizzes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <Target size={20} className="text-accent" />
                {t('available_quizzes')}
              </h3>
            </div>
            {isLoadingExtra ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-accent" /></div>
            ) : quizzes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quizzes.map((quiz) => (
                  <div key={quiz.id} className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-accent/30 transition-all cursor-pointer">
                    <h4 className="font-bold text-slate-950">{quiz.title}</h4>
                    <p className="ls-body-text mt-1">{quiz.description}</p>
                    <div className="flex items-center gap-3 mt-4">
                      <span className="text-xs font-medium bg-slate-50 px-2 py-1 rounded text-slate-500">{quiz.difficulty}</span>
                      <span className="text-xs font-medium bg-slate-50 px-2 py-1 rounded text-slate-500">{quiz.questions?.length || 0} Questions</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50/50 border border-solid border-slate-200 rounded-3xl p-16 text-center">
                <p className="text-slate-500">{t('no_quizzes_for_lessons')}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'exercises' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                <Dumbbell size={20} className="text-accent" />
                {t('practice_exercises')}
              </h3>
            </div>
            {isLoadingExtra ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-accent" /></div>
            ) : exercises.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exercises.map((exercise) => (
                  <div key={exercise.id} className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-accent/30 transition-all cursor-pointer">
                    <h4 className="font-bold text-slate-950">{exercise.title}</h4>
                    <p className="ls-body-text mt-1 line-clamp-2">{exercise.prompt}</p>
                    <div className="flex items-center gap-3 mt-4">
                      <span className="text-xs font-medium bg-slate-50 px-2 py-1 rounded text-slate-500">{exercise.difficulty}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50/50 border border-solid border-slate-200 rounded-3xl p-16 text-center">
                <p className="text-slate-500">{t('no_exercises_for_lessons')}</p>
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
              className="space-y-4 pt-8 border-t border-slate-200"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                  <Sparkles size={20} className="text-accent" />
                  Suggested Units
                </h3>
                <div className="flex items-center gap-4">
                  {selectedSuggestions.length > 0 ? (
                    <button 
                      onClick={handleCurateSelected}
                      disabled={!!generatingTitle}
                      className="text-xs font-medium text-blue-700 hover:underline disabled:opacity-50"
                    >
                      {generatingTitle === 'selected' ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}
                      Curate Selected ({selectedSuggestions.length})
                    </button>
                  ) : (
                    <button 
                      onClick={handleCurateAll}
                      disabled={!!generatingTitle}
                      className="text-xs font-medium text-blue-700 hover:underline disabled:opacity-50"
                    >
                      {generatingTitle === 'all' ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}
                      Curate All
                    </button>
                  )}
                  <button 
                    onClick={() => setSuggestions([])}
                    className="ls-micro-label hover:text-slate-950"
                  >
                    Close Gallery
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      className={`bg-white border p-6 rounded-2xl space-y-4 transition-all group cursor-pointer relative ${
                        isSelected ? 'border-accent ring-1 ring-accent/20 bg-accent/[0.02]' : 'border-slate-200 hover:border-accent/30'
                      } ${anyGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isSelected && (
                        <div className="absolute top-4 right-4 text-accent">
                          <CheckCircle2 size={16} />
                        </div>
                      )}
                      <div className="space-y-1">
                        <h4 className={`text-base font-bold transition-colors ${isSelected ? 'text-accent' : 'text-slate-950 group-hover:text-accent'}`}>
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
                          className="flex items-center gap-2 text-xs font-medium text-blue-700 hover:underline disabled:opacity-50"
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
                          className="flex items-center gap-2 text-xs font-medium text-slate-950  hover:underline disabled:opacity-50"
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
    </Layout>
  );
};
