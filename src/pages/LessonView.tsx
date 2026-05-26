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
import { useDisplayedLessonBlocks } from '../features/lesson/useDisplayedLessonBlocks';
import { AIAssistant } from '../components/AIAssistant';
import {
  getLessonSelectColumns,
  inferLegacyLessonSourceConfidence,
  inferLegacyLessonSourceName,
  inferLegacyLessonValidationStatus,
  isMissingLessonValidationColumnError,
} from '../services/lessonSupabase';
import { isStudentVisibleLesson, getLessonAvailabilityState } from '../services/lessonRecovery';
import { isDraftValidationStatus } from '../services/curriculumValidation';

type SupabaseLessonRecord = {
  id?: string;
  topic_id?: string | null;
  lesson_title: string;
  content?: string | null;
  blocks?: any[] | null;
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

const isRTL = (text: string) => /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

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

const PendingLessonView: React.FC<{ title: string; lessonId: string; onReady: () => void }> = ({ title, lessonId, onReady }) => {
  const navigate = useNavigate();
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
        <button onClick={() => navigate('/dashboard')} className="text-xs text-muted transition-colors hover:text-accent">
          Back to dashboard
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

  const startAtTest = location.state?.startAtTest || false;

  const [supabaseLesson, setSupabaseLesson] = useState<SupabaseLessonRecord | null>(null);
  const [curriculumContext, setCurriculumContext] = useState<CurriculumContext | null>(null);
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
        
        const getAvailabilityRank = (l: any) => {
          const state = getLessonAvailabilityState(l);
          switch (state) {
            case 'published': return 5;
            case 'needs_review': return 4;
            case 'draft_with_content': return 3;
            case 'locked': return 2;
            case 'rejected': return 1;
            default: return 0;
          }
        };

        let foundLesson: SupabaseLessonRecord | null = null;
        if (lessonsList.length > 0) {
          const sortedLessons = [...lessonsList].sort((a, b) => getAvailabilityRank(b) - getAvailabilityRank(a));
          foundLesson = sortedLessons[0];
        }

        setSupabaseLesson(foundLesson);

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
        title: supabaseLesson.lesson_title,
        content: supabaseLesson.content || '',
        blocks: Array.isArray(supabaseLesson.blocks) ? supabaseLesson.blocks : [],
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
        subtitle: lesson.subtitle || '',
        grade: lesson.grade || '',
        subject: lesson.subject || '',
        bannerImage: lesson.bannerImage || undefined,
      } as any;
    }

    return undefined;
  }, [lesson, supabaseLesson, curriculumContext]);

  const targetModuleId = effectiveLesson?.moduleId;
  const lessonsInModule = useLiveQuery(
    () => (targetModuleId ? db.lessons.where('moduleId').equals(targetModuleId).sortBy('createdAt') : Promise.resolve([])),
    [targetModuleId]
  );

  const orderedLessons = useMemo(() => {
    if (!lessonsInModule) return [];
    return lessonsInModule.filter((l) => {
      if (l.status === 'suggested') return false;
      return isAdmin || isStudentVisibleLesson(l);
    });
  }, [lessonsInModule, isAdmin]);

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
    if (storedBlocks.length > 0) return storedBlocks;
    if (!effectiveLesson?.content?.trim()) return [];
    return [{ type: 'content', title: effectiveLesson.title, content: effectiveLesson.content }];
  }, [effectiveLesson?.content, effectiveLesson?.title, storedBlocks]);
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
          <button onClick={() => navigate('/dashboard')} className="text-accent hover:underline">{t('return_to_dashboard')}</button>
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
          <button onClick={() => navigate('/dashboard')} className="text-accent hover:underline">{t('return_to_dashboard')}</button>
        </div>
      </Layout>
    );
  }

  if (effectiveLesson.status === 'pending' && !hasStoredContent) {
    return <PendingLessonView title={effectiveLesson.title} lessonId={id!} onReady={() => window.location.reload()} />;
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

      <div dir={contentDir} className="min-h-screen bg-background">
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
          onBack={() => navigate('/dashboard')}
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
          onNavigateToLesson={(lessonId) => navigate(`/lesson/${lessonId}`)}
          hasTests={hasTests}
          bannerImage={effectiveLesson.bannerImage}
          onUpdateBanner={handleUpdateBanner}
          startAtTest={startAtTest}
          allLessonsInModule={orderedLessons}
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
          lessonContent={readerSourceBlocks.map((block: any) => getBlockText(block)).join('\n')}
          subject={effectiveLesson.subject}
          grade={effectiveLesson.grade}
          strictRAG={true}
        />
      </div>
    </Layout>
  );
};
