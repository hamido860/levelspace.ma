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
import { getGradeCandidates, getSubjectCandidates, normalizeCurriculumValue, pickBestCurriculumMatch } from '../services/curriculumMatching';
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
  const [generatingTitle, setGeneratingTitle] = useState<string | null>(null);
  const [isFetchingGallery, setIsFetchingGallery] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isGeneratingStarterLessons, setIsGeneratingStarterLessons] = useState(false);
  const [isHydratingSupabase, setIsHydratingSupabase] = useState(false);
  const [topicFallbackRows, setTopicFallbackRows] = useState<SupabaseTopicRow[]>([]);
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
  const settingsMap = Object.fromEntries(dbSettings.map(s => [s.key, s.value]));

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
  const topicFallbackDomains = useMemo(() => {
    const domains = new Map<string, { key: string; code: string; name: string; order: number }>();
    for (const topic of topicFallbackRows) {
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
  }, [topicFallbackRows]);
  const isFrenchClassroom = useMemo(() => {
    const normalizedName = normalizeCurriculumValue(module?.name || '');
    return normalizedName === 'francais' || normalizedName === 'langue francaise' || normalizedName === 'french';
  }, [module?.name]);
  const showDomainTabs = isFrenchClassroom && topicFallbackDomains.length > 0;
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

    if (activeDomainKey !== 'all' && !topicFallbackDomains.some((domain) => domain.key === activeDomainKey)) {
      setActiveDomainKey('all');
    }
  }, [activeDomainKey, showDomainTabs, topicFallbackDomains]);

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

  const handleSeedFromSupabase = async () => {
    if (!module) return;
    setIsSeeding(true);
    try {
      const existingTitles = new Set(storedLessons.map((lesson) => normalizeLessonTitle(lesson.title)));
      const dbLessons = await fetchSupabaseLessons();

      if (!dbLessons || dbLessons.length === 0) {
        const topics = await fetchSupabaseTopics();

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
      const res = await fetch('/api/admin/lessons/seed-starter', {
        method: 'POST',
        headers: await getAdminApiHeaders(),
        body: JSON.stringify({ topic_ids: topicFallbackRows.map((topic) => topic.id) }),
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

      const inserted = Number(payload.summary?.insertedLessons ?? 0);
      const skipped = Number(payload.summary?.skippedLessons ?? 0);
      toast.success(`Generated ${inserted} starter lessons. Skipped ${skipped} existing topics.`);

      const cloudLessons = await fetchSupabaseLessons();
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
          <BookOpen className="w-12 h-12 text-muted/20" />
          <p className="text-ink font-medium">Classroom not found.</p>
          <button onClick={() => navigate('/dashboard')} className="text-accent hover:underline">Return to Dashboard</button>
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
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted hover:text-ink transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Dashboard
            </button>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="bg-accent/10 text-accent text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">{module.code}</span>
                <span className="text-muted text-xs font-medium">{module.category}</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold font-display leading-[0.88] tracking-tight text-ink editorial-title">{module.name}</h1>
              <p className="text-muted text-sm max-w-2xl leading-relaxed">{module.description}</p>
            </div>
          </div>

          {!showSetupState && (
            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              {isAdmin && (
                <button
                  onClick={handleSeedFromSupabase}
                  disabled={isSeeding}
                  className="flex items-center gap-2 bg-surface-low text-ink px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-ink/5 hover:border-accent/30 hover:text-accent disabled:opacity-50"
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
                      className="flex items-center gap-2 bg-surface-low text-muted hover:text-accent px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-ink/5"
                    >
                      <ShieldCheck size={14} />
                      Audit
                    </button>
                  )}
                  <button
                    onClick={() => handleGenerateLesson()}
                    disabled={!!generatingTitle}
                    className="flex items-center gap-2 bg-ink text-paper px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-accent transition-all shadow-lg shadow-ink/10 disabled:opacity-50"
                  >
                    {generatingTitle === module.name ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {hasLessons ? 'Generate Lesson' : 'Generate First Lesson'}
                  </button>
                </>
              ) : (
                <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-bold uppercase tracking-widest">
                  AI features need an API key
                </div>
              )}
            </div>
          )}
        </div>

        {/* Admin Controls */}
        {isAdmin && (
          <div className="bg-surface-low/70 rounded-2xl p-4 border border-ink/5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Admin Controls</p>
                <p className="text-sm text-ink font-medium">Keep this classroom grounded in certified content before using AI.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-paper border border-ink/5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Strict RAG</p>
                    <p className="text-[11px] text-muted">Use lesson context only</p>
                  </div>
                  <button
                    onClick={async () => {
                      await db.modules.update(module.id, { strictRAG: !module.strictRAG });
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative ${module.strictRAG ? 'bg-accent' : 'bg-ink/20'}`}
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
          <div className="bg-surface-low/50 border border-ink/5 rounded-3xl p-6 flex items-center gap-3 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            Checking Supabase for existing lessons, topics, and outlines...
          </div>
        )}

        {hasTopicFallback && (
          <div className="rounded-3xl border border-blue-200 bg-blue-50 px-5 py-4 text-blue-950">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Topics found, but lessons are not generated yet.</p>
                  <p className="mt-1 text-sm text-blue-800">
                    {topicFallbackRows.length} curriculum topics are available from Supabase. Outlines are shown below when available; starter lessons stay out of RAG until reviewed.
                  </p>
                  {topicFallbackDomains.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {topicFallbackDomains.map((domain) => (
                        <span key={domain.key} className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-800">
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
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
                >
                  {isGeneratingStarterLessons ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                  {isGeneratingStarterLessons ? 'Generating...' : 'Generate starter lessons'}
                </button>
              )}
            </div>
          </div>
        )}

        {showStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-paper border border-ink/5 rounded-2xl p-6 space-y-2">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Progress</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-ink">{module.progress}%</span>
                <span className="text-xs text-muted">Complete</span>
              </div>
              <div className="w-full h-1.5 bg-surface-low rounded-full overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${module.progress}%` }} />
              </div>
            </div>
            <div className="bg-paper border border-ink/5 rounded-2xl p-6 space-y-2">
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Lessons</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-ink">{hasLessons ? lessons.length : topicFallbackRows.length}</span>
                <span className="text-xs text-muted">{hasLessons ? 'Units Curated' : 'Topics need starter lessons'}</span>
              </div>
            </div>
          </div>
        )}

        {showSetupState ? (
          <div className="bg-surface-low/50 border border-dashed border-ink/10 rounded-3xl p-10 md:p-14 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-16 h-16 bg-paper rounded-full flex items-center justify-center shadow-sm">
              <BookOpen size={24} className="text-accent" />
            </div>
            <div className="space-y-2 max-w-md">
              <p className="text-xl font-bold text-ink">Set up this classroom</p>
              <p className="text-sm text-muted">Start with teacher-reviewed or officially validated curriculum units, then add draft AI content only when you need it.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted">
              <span className="px-3 py-1 rounded-full bg-paper border border-ink/5">Supabase First</span>
              <span className="px-3 py-1 rounded-full bg-paper border border-ink/5">Local Classroom</span>
              <span className="px-3 py-1 rounded-full bg-paper border border-ink/5">{module.strictRAG ? 'Strict RAG On' : 'Strict RAG Off'}</span>
            </div>
            {!aiAvailable && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 w-full max-w-md">
                <p className="text-xs text-amber-800 font-medium">AI features need an API key, but you can still load certified units right now.</p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
              <button
                onClick={handleSeedFromSupabase}
                disabled={isSeeding}
                className="flex-1 flex items-center justify-center gap-2 bg-ink text-paper px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-accent transition-all disabled:opacity-50"
              >
                {isSeeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                {isSeeding ? 'Loading...' : 'Load from Supabase'}
              </button>
              {aiAvailable && (
                <button
                  onClick={() => handleGenerateLesson()}
                  disabled={!!generatingTitle}
                  className="flex-1 flex items-center justify-center gap-2 bg-paper text-ink px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest border border-ink/5 hover:border-accent/30 hover:text-accent transition-all disabled:opacity-50"
                >
                  {generatingTitle === module.name ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Generate First Lesson
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            {showTabs && (
              <div className="flex gap-2 border-b border-ink/10 overflow-x-auto pb-2">
                {(['lessons', 'quizzes', 'exercises'] as const).map((tabKey) => {
                  const tabConfig = CLASSROOM_TAB_CONFIG[tabKey];
                  const TabIcon = tabConfig.icon;
                  const isActive = activeTab === tabKey;
                  return (
                    <button
                      key={tabKey}
                      onClick={() => setActiveTab(tabKey)}
                      className={`flex items-center gap-2 rounded-t-2xl px-4 py-3 text-sm font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
                        isActive
                          ? tabConfig.activeClass
                          : 'border-transparent text-muted hover:bg-surface-low hover:text-ink'
                      }`}
                    >
                      <TabIcon size={16} className={isActive ? tabConfig.iconClass : 'text-muted'} />
                      {tabConfig.label}
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
                  <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <BookOpen size={20} className="text-accent" />
                    {hasTopicFallback ? 'Curriculum Topics' : 'Curriculum Units'}
                  </h3>
                  {lessons.length > 0 && suggestions.length === 0 && (
                    <button
                      onClick={fetchGallery}
                      disabled={isFetchingGallery || !aiAvailable}
                      title={!aiAvailable ? "AI features need an API key, but your classroom content is available." : ""}
                      className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isFetchingGallery ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      Fetch Lesson Gallery
                    </button>
                  )}
                </div>

                {showDomainTabs && (
                  <div className="rounded-2xl border border-ink/5 bg-paper p-2">
                    <div className="flex gap-2 overflow-x-auto">
                      <button
                        onClick={() => setActiveDomainKey('all')}
                        className={`shrink-0 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
                          activeDomainKey === 'all'
                            ? 'bg-accent text-paper shadow-sm'
                            : 'text-muted hover:bg-surface-low hover:text-ink'
                        }`}
                      >
                        Tous
                      </button>
                      {topicFallbackDomains.map((domain) => (
                        <button
                          key={domain.key}
                          onClick={() => setActiveDomainKey(domain.key)}
                          className={`shrink-0 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
                            activeDomainKey === domain.key
                              ? 'bg-accent text-paper shadow-sm'
                              : 'text-muted hover:bg-surface-low hover:text-ink'
                          }`}
                        >
                          {domain.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 gap-3">
                  {Array.isArray(lessons) && lessons.length > 0 ? (
                    lessons.map((lesson, i) => (
                      <motion.div 
                        key={lesson.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => navigate(`/lesson/${lesson.id}`)}
                        className="bg-paper border border-ink/5 p-5 rounded-2xl flex items-center justify-between group cursor-pointer hover:border-accent/30 hover:shadow-xl hover:shadow-ink/5 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                            lesson.status === 'done' ? 'bg-emerald-50 text-emerald-600' : 'bg-surface-low text-muted group-hover:bg-accent/10 group-hover:text-accent'
                          }`}>
                            {lesson.status === 'done' ? <CheckCircle2 size={24} /> : <Play size={20} className="ml-1" />}
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-ink group-hover:text-accent transition-colors">{lesson.title}</h4>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className={getCurriculumValidationBadgeClass(lesson.validation_status, !!lesson.is_ai_generated)}>
                                {getCurriculumValidationLabel(lesson.validation_status, !!lesson.is_ai_generated)}
                              </span>
                              {lesson.source_confidence ? (
                                <span className="pill pill--neutral">
                                  {Math.round(Number(lesson.source_confidence) * 100)}% source confidence
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[10px] font-mono uppercase tracking-widest text-muted/60">Unit {i + 1}</span>
                              <span className="w-1 h-1 rounded-full bg-ink/10" />
                              <span className="text-[10px] font-mono uppercase tracking-widest text-muted/60">~15 min</span>
                            </div>
                            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                              <TagsManager 
                                tags={lesson.tags || []} 
                                onAddTag={async (tag) => {
                                  const currentTags = lesson.tags || [];
                                  if (!currentTags.includes(tag)) {
                                    await db.lessons.update(lesson.id, { tags: [...currentTags, tag] });
                                  }
                                }}
                                onRemoveTag={async (tag) => {
                                  const currentTags = lesson.tags || [];
                                  await db.lessons.update(lesson.id, { tags: currentTags.filter(t => t !== tag) });
                                }}
                                maxDisplay={7}
                              />
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-muted/30 group-hover:text-accent group-hover:translate-x-1 transition-all" />
                      </motion.div>
                    ))
                  ) : hasTopicFallback ? (
                    visibleTopicFallbackRows.map((topic, i) => (
                      <motion.div
                        key={topic.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="bg-paper border border-dashed border-ink/10 p-5 rounded-2xl"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                            <Clock size={22} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-base font-bold text-ink">{topic.title}</h4>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="pill pill--warn">needs lesson generation</span>
                              <span className="pill pill--neutral">topic from Supabase</span>
                              {topic.domain_name && <span className="pill pill--neutral">{topic.domain_name}</span>}
                              <span className="pill pill--neutral">RAG disabled until reviewed</span>
                            </div>
                            {topic.outlines.length > 0 ? (
                              <div className="mt-4 rounded-2xl border border-ink/5 bg-surface-low/60 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Available outline</p>
                                <div className="mt-2 space-y-2">
                                  {topic.outlines.slice(0, 3).map((outline) => (
                                    <div key={outline.id} className="rounded-xl bg-paper/70 px-3 py-2">
                                      <p className="text-sm font-semibold text-ink">{outline.title || 'Untitled outline item'}</p>
                                      {outline.description && (
                                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{outline.description}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                {topic.outlines.length > 3 && (
                                  <p className="mt-2 text-xs font-medium text-muted">+{topic.outlines.length - 3} more outline items</p>
                                )}
                              </div>
                            ) : (
                              <p className="mt-3 text-xs text-muted">No outline rows available yet for this topic.</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[10px] font-mono uppercase tracking-widest text-muted/60">Topic {i + 1}</span>
                            </div>
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
              <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                <Target size={20} className="text-accent" />
                Available Quizzes
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
                <p className="text-muted">No quizzes available for these lessons yet.</p>
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
                <p className="text-muted">No exercises available for these lessons yet.</p>
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
              className="space-y-4 pt-8 border-t border-ink/5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                  <Sparkles size={20} className="text-accent" />
                  Suggested Units
                </h3>
                <div className="flex items-center gap-4">
                  {selectedSuggestions.length > 0 ? (
                    <button 
                      onClick={handleCurateSelected}
                      disabled={!!generatingTitle}
                      className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline disabled:opacity-50"
                    >
                      {generatingTitle === 'selected' ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}
                      Curate Selected ({selectedSuggestions.length})
                    </button>
                  ) : (
                    <button 
                      onClick={handleCurateAll}
                      disabled={!!generatingTitle}
                      className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline disabled:opacity-50"
                    >
                      {generatingTitle === 'all' ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}
                      Curate All
                    </button>
                  )}
                  <button 
                    onClick={() => setSuggestions([])}
                    className="text-[10px] font-bold text-muted uppercase tracking-widest hover:text-ink"
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
                      className={`bg-paper border p-6 rounded-2xl space-y-4 transition-all group cursor-pointer relative ${
                        isSelected ? 'border-accent ring-1 ring-accent/20 bg-accent/[0.02]' : 'border-ink/5 hover:border-accent/30'
                      } ${anyGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isSelected && (
                        <div className="absolute top-4 right-4 text-accent">
                          <CheckCircle2 size={16} />
                        </div>
                      )}
                      <div className="space-y-1">
                        <h4 className={`text-base font-bold transition-colors ${isSelected ? 'text-accent' : 'text-ink group-hover:text-accent'}`}>
                          {suggestion.title}
                        </h4>
                        <p className="text-xs text-muted leading-relaxed">{suggestion.description}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateLesson(suggestion.title);
                          }}
                          disabled={anyGenerating}
                          className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-widest hover:underline disabled:opacity-50"
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
                          className="flex items-center gap-2 text-[10px] font-bold text-ink uppercase tracking-widest hover:underline disabled:opacity-50"
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
