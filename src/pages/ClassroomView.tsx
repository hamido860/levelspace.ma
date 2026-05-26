import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { ShieldCheck, ArrowLeft, BookOpen, Plus, Sparkles, Loader2, Play, Target, Dumbbell, Database } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { supabase } from '../db/supabase';
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
  selectStudentFacingValidatedContent,
} from '../services/curriculumValidation';

const normalizeLessonTitle = (title: string | null | undefined) =>
  String(title || '').trim().toLocaleLowerCase();

const getLessonCardIllustration = (title: string | null | undefined, fallback?: string | null | undefined) => {
  const value = `${title || ''} ${fallback || ''}`.toLowerCase();

  if (
    value.includes('math') ||
    value.includes('geom') ||
    value.includes('algebra') ||
    value.includes('calcul') ||
    value.includes('analyse')
  ) {
    return '/illustrations/math_geometry.png';
  }

  if (
    value.includes('phys') ||
    value.includes('chem') ||
    value.includes('chim') ||
    value.includes('electr')
  ) {
    return '/illustrations/physics_chemistry.png';
  }

  if (
    value.includes('svt') ||
    value.includes('earth') ||
    value.includes('life') ||
    value.includes('geolog') ||
    value.includes('biolog')
  ) {
    return '/illustrations/earth_sciences.png';
  }

  if (
    value.includes('fran') ||
    value.includes('arab') ||
    value.includes('lang') ||
    value.includes('litt') ||
    value.includes('gramm')
  ) {
    return '/illustrations/humanities_languages.png';
  }

  return '/illustrations/default_edu.png';
};

const isDevAdminModeEnabled = () =>
  String(import.meta.env.VITE_ENABLE_DEV_ADMIN_AI_KEYS || '').toLowerCase() === 'true';

const shouldUseDemoAdminHeader = () =>
  isDevAdminModeEnabled() ||
  (typeof localStorage !== 'undefined' && localStorage.getItem('demo_admin_logged_in') === 'true');

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

const resolveCurriculumIds = async (
  grade: string,
  subject: string,
  category?: string | null,
  scopedIds?: { gradeId?: string; subjectId?: string },
) => {
  if (scopedIds?.gradeId && scopedIds?.subjectId) {
    const { data, error } = await supabase
      .from('grade_subjects')
      .select('grade_id, subject_id')
      .eq('grade_id', scopedIds.gradeId)
      .eq('subject_id', scopedIds.subjectId)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      return {
        gradeId: scopedIds.gradeId,
        subjectId: scopedIds.subjectId,
        subjectIds: [scopedIds.subjectId],
      };
    }

    console.warn('[ClassroomView] Rejected invalid stored grade/subject ids.', scopedIds);
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
  const currentGradeId = settingsMap['selected_grade_id'] || localStorage.getItem('selected_grade_id') || '';
  const currentSubjectId = settingsMap['selected_subject_id'] || localStorage.getItem('selected_subject_id') || '';
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
    const { gradeId, subjectId, subjectIds } = await resolveCurriculumIds(currentGrade, module.name, module.category, {
      gradeId: currentGradeId,
      subjectId: currentSubjectId || module.id,
    });
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

    const { gradeId, subjectId, subjectIds } = await resolveCurriculumIds(currentGrade, module.name, module.category, {
      gradeId: currentGradeId,
      subjectId: currentSubjectId || module.id,
    });
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

    for (let start = 0; start < topicIds.length; start += 100) {
      const batch = topicIds.slice(start, start + 100);
      const { data: outlineRows, error: outlinesError } = await supabase
        .from('topic_outlines')
        .select('id, topic_id, title, description, outline_order')
        .in('topic_id', batch)
        .order('outline_order', { ascending: true });

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
        const { gradeId, subjectId, subjectIds } = await resolveCurriculumIds(currentGrade, module.name, module.category, {
          gradeId: currentGradeId,
          subjectId: currentSubjectId || module.id,
        });

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

  const getAdminApiHeaders = async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession();
    const accessToken = data?.session?.access_token;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    } else if (shouldUseDemoAdminHeader()) {
      headers['x-levelspace-demo-admin'] = 'true';
    }

    return headers;
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

      for (const title of selectedSuggestions) {
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
      }
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
      for (const title of titles) {
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
      }
      setSuggestions([]);
      setSelectedSuggestions([]);
    } catch (error) {
      console.error("Failed to curate all:", error);
    } finally {
      setGeneratingTitle(null);
    }
  };

  const closeLessonGallery = () => {
    if (generatingTitle) return;
    setSuggestions([]);
    setSelectedSuggestions([]);
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

        toast.info("No lessons found yet.");
        setIsSeeding(false);
        return;
      }

      await hydrateLessonCache(dbLessons);
      setCurriculumTopicRows(await fetchSupabaseTopics());
      setTopicFallbackRows([]);
      cloudHydrationKeyRef.current = classroomScopeKey;

      await db.modules.update(module.id, { strictRAG: true });
      
      toast.success(`Loaded ${dbLessons.length} lessons.`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load lessons: ' + err.message);
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

      for (let start = 0; start < topicIds.length; start += 25) {
        const batch = topicIds.slice(start, start + 25);
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

        inserted += Number(payload.summary?.insertedLessons ?? 0);
      }

      toast.success(`Generated ${inserted} lessons.`);

      const cloudLessons = await fetchSupabaseLessons();
      setCurriculumTopicRows(await fetchSupabaseTopics());
      await hydrateLessonCache(cloudLessons);
      setTopicFallbackRows([]);
      cloudHydrationKeyRef.current = classroomScopeKey;
      await db.modules.update(module.id, { strictRAG: false });
    } catch (err: any) {
      console.error(err);
      const message =
        err?.message === 'Failed to fetch'
          ? 'API server is not reachable. Start or restart the dev server and try again.'
          : err?.message || 'Unknown error';
      toast.error(`Failed to generate lessons: ${message}`);
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
          <p className="text-slate-950 dark:text-ink font-medium">{t('classroom_not_found')}</p>
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
              className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-950 transition-colors dark:text-ink-muted dark:hover:text-ink"
            >
              <ArrowLeft size={14} />
              {t('back_to_dashboard')}
            </button>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="bg-accent/10 text-accent text-xs font-medium px-2 py-0.5 rounded ">{module.code}</span>
                <span className="text-slate-500 text-xs font-medium dark:text-ink-muted">{module.category}</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold font-display leading-[0.88] tracking-tight text-slate-950 dark:text-ink editorial-title">{module.name}</h1>
              {module.description && module.description !== 'Supabase curriculum subject' && (
                <p className="ls-body-text max-w-2xl leading-relaxed">{module.description}</p>
              )}
            </div>
          </div>

          {!showSetupState && (
            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              {isAdmin && (
                <button
                  onClick={handleSeedFromSupabase}
                  disabled={isSeeding}
                  className="flex items-center gap-2 bg-slate-50 text-slate-950 px-4 py-3 rounded-xl text-xs font-medium transition-all border border-slate-200 hover:border-accent/30 hover:text-accent disabled:opacity-50 dark:bg-paper dark:text-ink dark:border-white/10 dark:hover:bg-surface-low"
                >
                  {isSeeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                  {isSeeding ? 'Loading' : 'Load lessons'}
                </button>
              )}
              {aiAvailable ? (
                <>
                  {isAdmin && hasLessons && (
                    <button
                      onClick={handleAuditClassroom}
                      className="flex items-center gap-2 bg-slate-50 text-slate-500 hover:text-accent px-4 py-3 rounded-xl text-xs font-medium transition-all border border-slate-200 dark:bg-paper dark:text-ink-muted dark:border-white/10 dark:hover:bg-surface-low"
                    >
                      <ShieldCheck size={14} />
                      Audit
                    </button>
                  )}
                  <button
                    onClick={() => handleGenerateLesson()}
                    disabled={!!generatingTitle}
                    className="flex items-center gap-2 bg-slate-950 text-white px-6 py-3 rounded-xl text-xs font-bold  hover:bg-accent transition-all shadow-sm shadow-ink/10 disabled:opacity-50 dark:bg-surface-low dark:text-ink dark:hover:bg-surface-high"
                  >
                    {generatingTitle === module.name ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {hasLessons ? 'Generate Lesson' : 'Generate First Lesson'}
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        {isHydratingSupabase && !hasLessons && !hasTopicFallback && (
          <div className="bg-slate-50/50 border border-slate-200 rounded-3xl p-4 flex items-center gap-3 ls-body-text dark:bg-surface-low/50 dark:border-white/10">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            Loading lessons...
          </div>
        )}

        {hasTopicFallback && isAdmin && (
          <div className="rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-blue-950">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{topicFallbackRows.length} lessons ready to prepare.</p>
                  {topicFallbackDomains.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {topicFallbackDomains.map((domain) => (
                        <span key={domain.key} className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                          {domain.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={handleGenerateStarterLessons}
                  disabled={isGeneratingStarterLessons}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
                >
                  {isGeneratingStarterLessons ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                  {isGeneratingStarterLessons ? 'Generating...' : 'Generate lessons'}
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
                <span className="text-3xl font-bold text-slate-950 dark:text-ink">{module.progress}%</span>
                <span className="ls-micro-label">Complete</span>
              </div>
              <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden dark:bg-surface-mid">
                <div className="h-full bg-accent" style={{ width: `${module.progress}%` }} />
              </div>
            </div>
            <div className="ls-card p-6 space-y-2">
              <p className="ls-micro-label">Lessons</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-950 dark:text-ink">{hasLessons ? lessons.length : topicFallbackRows.length}</span>
                <span className="ls-micro-label">{hasLessons ? 'Lessons' : 'Ready'}</span>
              </div>
            </div>
          </div>
        )}

        {showSetupState ? (
          <div className="bg-slate-50/50 border border-solid border-slate-200 rounded-3xl p-10 md:p-14 flex flex-col items-center justify-center text-center space-y-6 dark:bg-surface-low/50 dark:border-white/10">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm dark:bg-surface-mid">
              <BookOpen size={24} className="text-accent" />
            </div>
            <div className="space-y-2 max-w-md">
              <p className="text-xl font-bold text-slate-950 dark:text-ink">No lessons yet</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
              {isAdmin && (
                <button
                  onClick={handleSeedFromSupabase}
                  disabled={isSeeding}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-950 text-white px-4 py-3 rounded-xl text-xs font-bold hover:bg-accent transition-all disabled:opacity-50"
                >
                  {isSeeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                  {isSeeding ? 'Loading...' : 'Load lessons'}
                </button>
              )}
              {aiAvailable && (
                <button
                  onClick={() => handleGenerateLesson()}
                  disabled={!!generatingTitle}
                  className="flex-1 flex items-center justify-center gap-2 bg-white text-slate-950 px-4 py-3 rounded-xl text-xs font-bold  border border-slate-200 hover:border-accent/30 hover:text-accent transition-all disabled:opacity-50 dark:bg-paper dark:text-ink dark:border-white/10 dark:hover:bg-surface-low"
                >
                  {generatingTitle === module.name ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Generate lesson
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            {showTabs && (
              <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 overflow-x-auto pb-2">
                {(['lessons', 'quizzes', 'exercises'] as const).map((tabKey) => {
                  const tabConfig = CLASSROOM_TAB_CONFIG[tabKey];
                  const TabIcon = tabConfig.icon;
                  const isActive = activeTab === tabKey;
                  return (
                    <button
                      key={tabKey}
                      onClick={() => setActiveTab(tabKey)}
                      className={`flex items-center gap-2 rounded-t-2xl px-4 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
                        isActive
                          ? tabConfig.activeClass
                          : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-950 dark:text-ink-muted dark:hover:bg-surface-low dark:hover:text-ink'
                      }`}
                    >
                      <TabIcon size={16} className={isActive ? tabConfig.iconClass : 'text-slate-500 dark:text-ink-muted'} />
                      {t(tabKey)}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tab Content */}
            {activeTab === 'lessons' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-950 dark:text-ink flex items-center gap-2">
                    <BookOpen size={20} className="text-accent" />
                    {hasTopicFallback ? t('curriculum_topics') : t('curriculum_units')}
                  </h3>
                  {lessons.length > 0 && suggestions.length === 0 && (
                    <button
                      onClick={fetchGallery}
                      disabled={isFetchingGallery || !aiAvailable}
                      title="More lessons"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed dark:border-white/10 dark:bg-paper dark:text-ink-muted"
                      aria-label="More lessons"
                    >
                      {isFetchingGallery ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    </button>
                  )}
                </div>

                {showDomainTabs && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-paper">
                    <div className="flex gap-2 overflow-x-auto">
                      <button
                        onClick={() => setActiveDomainKey('all')}
                        className={`shrink-0 rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                          activeDomainKey === 'all'
                            ? 'bg-accent text-white shadow-sm'
                            : 'text-slate-500 dark:text-ink-muted hover:bg-slate-50 dark:hover:bg-surface-low hover:text-slate-950 dark:hover:text-ink'
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
                              : 'text-slate-500 dark:text-ink-muted hover:bg-slate-50 dark:hover:bg-surface-low hover:text-slate-950 dark:hover:text-ink'
                          }`}
                        >
                          {domain.name}
                          {hasLessons && <span className="ml-1 opacity-70">{domain.count}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Array.isArray(lessons) && lessons.length > 0 ? (
                    visibleLessons.length > 0 ? visibleLessons.map((lesson, i) => (
                      <motion.div
                        key={lesson.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => navigate(`/lesson/${lesson.id}`)}
                        className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-accent/30 hover:shadow-md dark:border-white/10 dark:bg-paper"
                      >
                        <div className="flex items-center justify-between gap-3 bg-[#007A87] px-4 py-3 text-white dark:bg-accent">
                          <div className="flex min-w-0 items-center gap-2">
                            <BookOpen className="h-5 w-5 shrink-0 text-white" />
                            <h4 className="truncate text-sm font-bold leading-tight text-white" title={lesson.title}>
                              Lesson {i + 1}
                            </h4>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="max-w-[76px] truncate rounded-md bg-white/15 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                              Unit
                            </span>
                            {lesson.status === 'done' && (
                              <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                                Done
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="h-20 w-full overflow-hidden border-b border-slate-100 bg-slate-50 dark:border-white/5 dark:bg-surface-low">
                          <img
                            src={getLessonCardIllustration(lesson.title, module?.name || module?.category)}
                            alt={lesson.title}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        </div>

                        <div className="flex flex-1 flex-col gap-3 p-4">
                          <div className="grid grid-cols-[auto_1fr] items-center gap-3 text-sm">
                            <div className="flex min-w-0 items-center gap-2">
                              <BookOpen className="h-4 w-4 shrink-0 text-slate-400 dark:text-ink-muted" />
                              <span className="font-bold text-slate-800 dark:text-ink">{i + 1}</span>
                              <span className="truncate text-xs text-slate-500 dark:text-ink-muted" title={lesson.title}>
                                {lesson.title}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] font-bold">
                                <span className="text-slate-400 dark:text-ink-muted">Progress</span>
                                <span className="text-slate-800 dark:text-ink">{lesson.status === 'done' ? '100%' : '0%'}</span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-surface-mid">
                                <div
                                  className="h-full rounded-full bg-emerald-500"
                                  style={{ width: lesson.status === 'done' ? '100%' : '0%' }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/6">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/lesson/${lesson.id}`);
                                }}
                                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
                              >
                                <Play className="h-3 w-3 fill-current text-white" />
                                Start
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/lesson/${lesson.id}`);
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-paper dark:text-ink-secondary dark:hover:bg-surface-low"
                              >
                                Plan
                              </button>
                            </div>

                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                              lesson.status === 'done' ? 'text-accent' : 'text-emerald-700 dark:text-emerald-400'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${lesson.status === 'done' ? 'bg-accent' : 'bg-emerald-500 animate-pulse'}`} />
                              {lesson.status === 'done' ? 'Done' : 'Available'}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )) : (
                      <div className="col-span-full rounded-2xl border border-solid border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-paper">
                        <p className="text-sm font-semibold text-slate-950 dark:text-ink">No lessons in this domain yet.</p>
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
                        className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-accent/30 hover:shadow-md dark:border-white/10 dark:bg-paper"
                        onClick={() => handleGenerateLesson(topic.title, true)}
                      >
                        <div className="flex items-center justify-between gap-3 bg-[#007A87] px-4 py-3 text-white dark:bg-accent">
                          <div className="flex min-w-0 items-center gap-2">
                            <BookOpen className="h-5 w-5 shrink-0 text-white" />
                            <h4 className="truncate text-sm font-bold leading-tight text-white" title={topic.title}>
                              Lesson {i + 1}
                            </h4>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="max-w-[76px] truncate rounded-md bg-white/15 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                              Topic
                            </span>
                            {topic.domain_name && (
                              <span className="max-w-[76px] truncate rounded-md bg-white/15 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm" title={topic.domain_name}>
                                {topic.domain_name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="h-20 w-full overflow-hidden border-b border-slate-100 bg-slate-50 dark:border-white/5 dark:bg-surface-low">
                          <img
                            src={getLessonCardIllustration(topic.title, module?.name || module?.category)}
                            alt={topic.title}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        </div>

                        <div className="flex flex-1 flex-col gap-3 p-4">
                          <div className="grid grid-cols-[auto_1fr] items-center gap-3 text-sm">
                            <div className="flex min-w-0 items-center gap-2">
                              <BookOpen className="h-4 w-4 shrink-0 text-slate-400 dark:text-ink-muted" />
                              <span className="font-bold text-slate-800 dark:text-ink">{i + 1}</span>
                              <span className="truncate text-xs text-slate-500 dark:text-ink-muted" title={topic.title}>
                                {topic.title}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] font-bold">
                                <span className="text-slate-400 dark:text-ink-muted">Progress</span>
                                <span className="text-slate-800 dark:text-ink">0%</span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-surface-mid">
                                <div className="h-full w-0 rounded-full bg-emerald-500" />
                              </div>
                            </div>
                          </div>

                          <p className="line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-slate-500 dark:text-ink-muted">
                            {topic.outlines[0]?.description || topic.outlines[0]?.title || topic.title}
                          </p>

                          <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/6">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGenerateLesson(topic.title, true);
                                }}
                                disabled={!!generatingTitle}
                                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {generatingTitle === topic.title ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current text-white" />}
                                Start
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGenerateLesson(topic.title);
                                }}
                                disabled={!!generatingTitle}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-paper dark:text-ink-secondary dark:hover:bg-surface-low"
                              >
                                Plan
                              </button>
                            </div>

                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                              Available
                            </span>
                          </div>
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
              <h3 className="text-lg font-bold text-slate-950 dark:text-ink flex items-center gap-2">
                <Target size={20} className="text-accent" />
                {t('available_quizzes')}
              </h3>
            </div>
            {isLoadingExtra ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-accent" /></div>
            ) : quizzes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quizzes.map((quiz) => (
                  <div key={quiz.id} className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-accent/30 transition-all cursor-pointer dark:bg-paper dark:border-white/10">
                    <h4 className="font-bold text-slate-950 dark:text-ink">{quiz.title}</h4>
                    <p className="ls-body-text mt-1">{quiz.description}</p>
                    <div className="flex items-center gap-3 mt-4">
                      <span className="text-xs font-medium bg-slate-50 px-2 py-1 rounded text-slate-500 dark:bg-surface-mid dark:text-ink-muted">{quiz.difficulty}</span>
                      <span className="text-xs font-medium bg-slate-50 px-2 py-1 rounded text-slate-500 dark:bg-surface-mid dark:text-ink-muted">{quiz.questions?.length || 0} Questions</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50/50 border border-solid border-slate-200 rounded-3xl p-16 text-center dark:bg-surface-low/50 dark:border-white/10">
                <p className="text-slate-500 dark:text-ink-muted">{t('no_quizzes_for_lessons')}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'exercises' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-950 dark:text-ink flex items-center gap-2">
                <Dumbbell size={20} className="text-accent" />
                {t('practice_exercises')}
              </h3>
            </div>
            {isLoadingExtra ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-accent" /></div>
            ) : exercises.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exercises.map((exercise) => (
                  <div key={exercise.id} className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-accent/30 transition-all cursor-pointer dark:bg-paper dark:border-white/10">
                    <h4 className="font-bold text-slate-950 dark:text-ink">{exercise.title}</h4>
                    <p className="ls-body-text mt-1 line-clamp-2">{exercise.prompt}</p>
                    <div className="flex items-center gap-3 mt-4">
                      <span className="text-xs font-medium bg-slate-50 px-2 py-1 rounded text-slate-500 dark:bg-surface-mid dark:text-ink-muted">{exercise.difficulty}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50/50 border border-solid border-slate-200 rounded-3xl p-16 text-center dark:bg-surface-low/50 dark:border-white/10">
                <p className="text-slate-500 dark:text-ink-muted">{t('no_exercises_for_lessons')}</p>
              </div>
            )}
          </div>
        )}

        <Modal
          isOpen={suggestions.length > 0}
          onClose={closeLessonGallery}
          title={
            <span className="flex items-center gap-2">
              <Sparkles size={20} className="text-accent" />
              Suggested Units
            </span>
          }
          maxWidth="4xl"
        >
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="flex items-center gap-3">
                {selectedSuggestions.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleCurateSelected}
                    disabled={!!generatingTitle}
                    className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-accent disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-accent dark:hover:text-white"
                  >
                    {generatingTitle === 'selected' ? <Loader2 size={12} className="mr-1 inline animate-spin" /> : null}
                    Curate Selected ({selectedSuggestions.length})
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCurateAll}
                    disabled={!!generatingTitle}
                    className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-accent disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-accent dark:hover:text-white"
                  >
                    {generatingTitle === 'all' ? <Loader2 size={12} className="mr-1 inline animate-spin" /> : null}
                    Curate All
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.isArray(suggestions) && suggestions.map((suggestion, i) => {
                const isSelected = selectedSuggestions.includes(suggestion.title);
                const isThisGenerating = generatingTitle === suggestion.title;
                const anyGenerating = !!generatingTitle;
                const lessonNumber = i + 1;

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
                    className={`relative cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition-all group dark:bg-paper dark:border-white/10 ${
                      isSelected ? 'border-accent ring-1 ring-accent/20' : 'border-slate-200 hover:border-accent/30 hover:shadow-md dark:border-white/10'
                    } ${anyGenerating ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <div className="bg-[#007A87] px-4 py-3 flex items-center justify-between gap-3 text-white dark:bg-accent">
                      <div className="flex min-w-0 items-center gap-2">
                        <BookOpen className="h-5 w-5 shrink-0 text-white" />
                        <h4 className="truncate text-sm font-bold leading-tight text-white" title={suggestion.title}>
                          Lesson {lessonNumber}
                        </h4>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="max-w-[76px] truncate rounded-md bg-white/15 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                          AI
                        </span>
                        {isSelected && (
                          <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                            Selected
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="h-20 w-full overflow-hidden border-b border-slate-100 bg-slate-50 dark:border-white/5 dark:bg-surface-low">
                      <img
                        src={getLessonCardIllustration(suggestion.title, module?.name || module?.category)}
                        alt={suggestion.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>

                    <div className="flex flex-col gap-3 p-4">
                      <div className="grid grid-cols-[auto_1fr] items-center gap-3 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <BookOpen className="h-4 w-4 shrink-0 text-slate-400 dark:text-ink-muted" />
                          <span className="font-bold text-slate-800 dark:text-ink">{lessonNumber}</span>
                          <span className="truncate text-xs text-slate-500 dark:text-ink-muted" title={suggestion.title}>
                            {suggestion.title}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-slate-400 dark:text-ink-muted">Progress</span>
                            <span className="text-slate-800 dark:text-ink">0%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-surface-mid">
                            <div className="h-full w-0 rounded-full bg-emerald-500" />
                          </div>
                        </div>
                      </div>

                      <p className="line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-slate-500 dark:text-ink-muted">
                        {suggestion.description}
                      </p>

                      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/6">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateLesson(suggestion.title);
                            }}
                            disabled={anyGenerating}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {isThisGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                            Curate
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateLesson(suggestion.title, true);
                            }}
                            disabled={anyGenerating}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-paper dark:text-ink-secondary dark:hover:bg-surface-low"
                          >
                            Launch
                          </button>
                        </div>

                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                          isSelected ? 'text-accent' : 'text-emerald-700 dark:text-emerald-400'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-accent' : 'bg-emerald-500 animate-pulse'}`} />
                          {isSelected ? 'Selected' : 'Available'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
};
