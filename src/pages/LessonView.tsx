import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  FileText,
  HelpCircle,
  Lightbulb,
  List,
  Loader2,
  PenTool,
  XCircle,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { SEO } from '../components/SEO';
import { db } from '../db/db';
import { supabase } from '../db/supabase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getExercisesByLesson } from '../services/exerciseService';
import {
  getLessonSelectColumns,
  inferLegacyLessonSourceConfidence,
  inferLegacyLessonSourceName,
  inferLegacyLessonValidationStatus,
  isMissingLessonValidationColumnError,
} from '../services/lessonSupabase';
import { getQuizzesByLesson } from '../services/quizService';
import { isStudentVisibleLesson } from '../services/lessonRecovery';
import {
  getCurriculumValidationBadgeClass,
  getCurriculumValidationLabel,
  isDraftValidationStatus,
  isStudentPreferredValidationStatus,
} from '../services/curriculumValidation';

type LessonMainTab = 'content' | 'quizzes' | 'exercises';

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

type SubjectDomain = {
  id: string;
  code: string;
  name: string;
  domain_order: number;
};

type TopicOverview = {
  topic_id: string;
  topic_title: string;
  grade_id?: string | null;
  subject_id?: string | null;
  domain_id?: string | null;
  domain_code?: string | null;
  domain_name?: string | null;
  outline_count?: number | null;
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

const getBlockTitle = (block: any, index: number) =>
  String(block?.title || block?.label || block?.question || `Section ${index + 1}`);

const getBlockBody = (block: any) => {
  if (typeof block?.content === 'string') return block.content;
  if (Array.isArray(block?.points)) return block.points.join('\n');
  if (Array.isArray(block?.rules)) return block.rules.join('\n');
  if (block?.quiz?.question) return block.quiz.question;
  if (block?.exercise?.question) return block.exercise.question;
  if (block?.exam?.question) return block.exam.question;
  return '';
};

const getPedagogicalLabel = (block: any) => {
  const type = String(block?.type || '').toLowerCase();
  if (type === 'intro') return 'What you will learn';
  if (type === 'definition') return 'Definition';
  if (type === 'theory' || type === 'content' || type === 'text') return 'Explanation';
  if (type === 'formula') return 'Key formula';
  if (type === 'example' || type === 'examples') return 'Example';
  if (type === 'rules') return 'Key rules';
  if (type === 'exercise') return 'Practice';
  if (type === 'quiz') return 'Quick check';
  if (type === 'exam') return 'Exam-style question';
  if (type === 'summary') return 'Summary';
  return 'Lesson part';
};

const getBlockIcon = (block: any) => {
  const label = getPedagogicalLabel(block);
  if (label === 'Practice') return Dumbbell;
  if (label === 'Quick check') return HelpCircle;
  if (label === 'Exam-style question') return PenTool;
  if (label === 'Example') return Lightbulb;
  if (label === 'Summary' || label === 'Key rules') return List;
  if (label === 'Definition') return BookOpen;
  return FileText;
};

const buildLessonDescription = (lesson: any, fallback: string) => {
  const blockPreview = Array.isArray(lesson?.blocks)
    ? lesson.blocks.map((block: any) => getBlockBody(block)).filter(Boolean).join(' ')
    : '';
  return truncateText(stripMarkdown(lesson?.subtitle || lesson?.content || blockPreview || fallback));
};

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
  }, [lessonId, onReady]);

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

const LessonMarkdown: React.FC<{ children: string }> = ({ children }) => (
  <div className="lesson-copy max-w-none">
    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>
      {children}
    </Markdown>
  </div>
);

const LessonBlock: React.FC<{
  block: any;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onQuizAnswer: (index: number, option: string, correctAnswer: string) => void;
  quizAnswered: Record<number, boolean>;
  quizCorrect: Record<number, boolean>;
  quizSelectedOption: Record<number, string>;
}> = ({ block, index, expanded, onToggle, onQuizAnswer, quizAnswered, quizCorrect, quizSelectedOption }) => {
  const Icon = getBlockIcon(block);
  const label = getPedagogicalLabel(block);
  const title = getBlockTitle(block, index);
  const blockId = `block-${index}`;

  const renderBlockContent = () => {
    if (block?.type === 'summary' && Array.isArray(block.points)) {
      return (
        <ul className="space-y-3">
          {block.points.map((point: string, pointIndex: number) => (
            <li key={pointIndex} className="flex gap-3 text-sm leading-relaxed text-ink-secondary">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <LessonMarkdown>{point}</LessonMarkdown>
            </li>
          ))}
        </ul>
      );
    }

    if (block?.type === 'rules' && Array.isArray(block.rules)) {
      return (
        <ul className="space-y-3">
          {block.rules.map((rule: string, ruleIndex: number) => (
            <li key={ruleIndex} className="flex gap-3 text-sm leading-relaxed text-ink-secondary">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <LessonMarkdown>{rule}</LessonMarkdown>
            </li>
          ))}
        </ul>
      );
    }

    if ((block?.type === 'examples' || block?.type === 'example') && Array.isArray(block.examples)) {
      return (
        <div className="space-y-4">
          {block.examples.map((example: any, exampleIndex: number) => (
            <div key={exampleIndex} className="rounded-2xl bg-surface-low p-4">
              {example?.question && <LessonMarkdown>{String(example.question)}</LessonMarkdown>}
              {Array.isArray(example?.steps) && (
                <div className="mt-3 space-y-2 border-l-2 border-accent/20 pl-4">
                  {example.steps.map((step: string, stepIndex: number) => (
                    <LessonMarkdown key={stepIndex}>{step}</LessonMarkdown>
                  ))}
                </div>
              )}
              {example?.answer && (
                <div className="mt-3 rounded-xl bg-success-soft p-3 text-success">
                  <LessonMarkdown>{String(example.answer)}</LessonMarkdown>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    const flatQuizQuestion = block?.type === 'quiz' && block.question && Array.isArray(block.options);
    const nestedQuizQuestion = block?.type === 'quiz' && block.quiz?.question && Array.isArray(block.quiz.options);
    if (flatQuizQuestion || nestedQuizQuestion) {
      const question = flatQuizQuestion ? block.question : block.quiz.question;
      const options = flatQuizQuestion ? block.options : block.quiz.options;
      const correctAnswer = flatQuizQuestion ? block.correctAnswer : block.quiz.correctAnswer;
      const explanation = flatQuizQuestion ? block.explanation : block.quiz.explanation;
      const isAnswered = quizAnswered[index];

      return (
        <div className="space-y-4">
          <LessonMarkdown>{String(question)}</LessonMarkdown>
          <div className="grid gap-2">
            {options.map((option: string, optionIndex: number) => {
              const isSelected = quizSelectedOption[index] === option;
              const isCorrect = option === correctAnswer;
              const stateClass = !isAnswered
                ? 'border-surface-mid bg-paper hover:border-accent/40 hover:bg-accent/5'
                : isCorrect
                  ? 'border-success bg-success-soft text-success'
                  : isSelected
                    ? 'border-error bg-error-soft text-error'
                    : 'border-surface-mid bg-paper/60 text-muted';

              return (
                <button
                  key={optionIndex}
                  onClick={() => onQuizAnswer(index, option, correctAnswer)}
                  disabled={isAnswered}
                  className={`flex w-full items-center justify-between rounded-xl border-2 p-4 text-left text-sm font-medium transition-all ${stateClass}`}
                >
                  <span>{option}</span>
                  {isAnswered && isCorrect && <CheckCircle2 className="h-5 w-5" />}
                  {isAnswered && isSelected && !isCorrect && <XCircle className="h-5 w-5" />}
                </button>
              );
            })}
          </div>
          {isAnswered && (
            <div className={`rounded-xl p-4 text-sm ${quizCorrect[index] ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>
              <p className="font-bold">{quizCorrect[index] ? 'Correct' : 'Review this point'}</p>
              {explanation && <p className="mt-1 leading-relaxed">{explanation}</p>}
            </div>
          )}
        </div>
      );
    }

    const exercise = block?.exercise || (block?.type === 'exercise' ? block : null);
    if (exercise && (exercise.question || exercise.content || exercise.prompt)) {
      return (
        <div className="space-y-4">
          <LessonMarkdown>{String(exercise.question || exercise.content || exercise.prompt)}</LessonMarkdown>
          {(exercise.hint || exercise.solution) && (
            <div className="rounded-2xl bg-surface-low p-4 text-sm text-ink-secondary">
              {exercise.hint && <p><strong className="text-ink">Hint:</strong> {exercise.hint}</p>}
              {exercise.solution && <p className="mt-2"><strong className="text-ink">Solution:</strong> {exercise.solution}</p>}
            </div>
          )}
        </div>
      );
    }

    const body = getBlockBody(block);
    return body ? <LessonMarkdown>{body}</LessonMarkdown> : <p className="text-sm text-muted">No content for this section yet.</p>;
  };

  return (
    <article id={blockId} className="scroll-mt-28 rounded-3xl border border-surface-mid bg-paper shadow-sm">
      <button onClick={onToggle} className="flex w-full items-start gap-4 p-5 text-left md:p-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/8 text-accent">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p>
          <h2 className="mt-1 text-xl font-bold leading-tight text-ink md:text-2xl">{title}</h2>
        </div>
        <ChevronRight className={`mt-2 h-5 w-5 shrink-0 text-muted transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && <div className="border-t border-surface-mid px-5 pb-6 pt-5 md:px-6">{renderBlockContent()}</div>}
    </article>
  );
};

export const LessonView: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { isAdmin } = useAuth();
  const lesson = useLiveQuery(() => (id ? db.lessons.get(id) : undefined), [id]);

  const [supabaseLesson, setSupabaseLesson] = useState<SupabaseLessonRecord | null>(null);
  const [curriculumContext, setCurriculumContext] = useState<CurriculumContext | null>(null);
  const [domains, setDomains] = useState<SubjectDomain[]>([]);
  const [topics, setTopics] = useState<TopicOverview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openBlocks, setOpenBlocks] = useState<string[]>(['block-0']);
  const [activeTab, setActiveTab] = useState<LessonMainTab>('content');
  const [activeDomain, setActiveDomain] = useState('all');
  const [showOutlineModal, setShowOutlineModal] = useState(false);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [isLoadingExtra, setIsLoadingExtra] = useState(false);
  const [quizAnswered, setQuizAnswered] = useState<Record<number, boolean>>({});
  const [quizCorrect, setQuizCorrect] = useState<Record<number, boolean>>({});
  const [quizSelectedOption, setQuizSelectedOption] = useState<Record<number, string>>({});
  const blockRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!id) return;
    let isCancelled = false;

    const fetchLesson = async () => {
      setIsLoading(true);
      const fetchAttempt = async (includeValidation: boolean) => {
        const selectColumns = getLessonSelectColumns({ includeTags: true, includeValidation });
        return supabase
          .from('lessons')
          .select(selectColumns)
          .or(`id.eq.${id},topic_id.eq.${id}`)
          .maybeSingle()
          .throwOnError();
      };

      try {
        let response;
        try {
          response = await fetchAttempt(true);
        } catch (error) {
          if (!isMissingLessonValidationColumnError(error)) throw error;
          response = await fetchAttempt(false);
        }

        if (isCancelled) return;
        const foundLesson = response.data as SupabaseLessonRecord | null;
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

  useEffect(() => {
    if (!curriculumContext?.subject_id) return;
    let isCancelled = false;

    const fetchDomainOverview = async () => {
      const [{ data: domainRows }, { data: topicRows }] = await Promise.all([
        supabase
          .from('subject_domains')
          .select('id, code, name, domain_order')
          .eq('subject_id', curriculumContext.subject_id)
          .order('domain_order', { ascending: true }),
        supabase
          .from('topic_domain_overview')
          .select('topic_id, topic_title, grade_id, subject_id, domain_id, domain_code, domain_name, outline_count')
          .eq('subject_id', curriculumContext.subject_id)
          .eq('grade_id', curriculumContext.grade_id || '')
          .order('domain_order', { ascending: true }),
      ]);

      if (isCancelled) return;
      setDomains((domainRows || []) as SubjectDomain[]);
      setTopics((topicRows || []) as TopicOverview[]);
    };

    fetchDomainOverview().catch((error) => console.warn('[LessonView] Failed to load domain overview:', error));
    return () => {
      isCancelled = true;
    };
  }, [curriculumContext?.subject_id, curriculumContext?.grade_id]);

  useEffect(() => {
    if (!curriculumContext?.domain_code) return;
    setActiveDomain(curriculumContext.domain_code);
  }, [curriculumContext?.domain_code]);

  useEffect(() => {
    const fetchExtraData = async () => {
      const lessonId = supabaseLesson?.id || id;
      if (!lessonId || activeTab === 'content') return;
      setIsLoadingExtra(true);
      try {
        const [lessonQuizzes, lessonExercises] = await Promise.all([
          getQuizzesByLesson(lessonId),
          getExercisesByLesson(lessonId),
        ]);
        setQuizzes(lessonQuizzes || []);
        setExercises(lessonExercises || []);
      } catch (error) {
        console.warn('[LessonView] Failed to fetch lesson extras:', error);
      } finally {
        setIsLoadingExtra(false);
      }
    };

    fetchExtraData();
  }, [activeTab, id, supabaseLesson?.id]);

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
      } as any;
    }

    return undefined;
  }, [lesson, supabaseLesson, curriculumContext]);

  const blocks = Array.isArray(effectiveLesson?.blocks) ? effectiveLesson.blocks : [];
  const hasStoredContent = Boolean(effectiveLesson?.content?.trim()) || blocks.length > 0;
  const lessonDomainCode = curriculumContext?.domain_code || '';
  const lessonDomainName = curriculumContext?.domain_name || '';
  const domainTopics = topics.filter((topic) => activeDomain === 'all' || topic.domain_code === activeDomain);
  const showDomainOverview = activeDomain !== 'all' && activeDomain !== lessonDomainCode;
  const contentDir = isRTL(`${effectiveLesson?.title || ''} ${blocks[0]?.content || effectiveLesson?.content || ''}`)
    ? 'rtl'
    : language === 'ar'
      ? 'rtl'
      : 'ltr';
  const validationLabel = getCurriculumValidationLabel(effectiveLesson?.validation_status, !!effectiveLesson?.is_ai_generated);
  const validationBadgeClass = getCurriculumValidationBadgeClass(effectiveLesson?.validation_status, !!effectiveLesson?.is_ai_generated);
  const lessonHasPreferredValidation = isStudentPreferredValidationStatus(effectiveLesson?.validation_status, !!effectiveLesson?.is_ai_generated);
  const showValidationWarning =
    !isAdmin &&
    effectiveLesson &&
    isDraftValidationStatus(effectiveLesson.validation_status, !!effectiveLesson.is_ai_generated);
  const metaDescription = buildLessonDescription(
    effectiveLesson,
    `${effectiveLesson?.subject || 'Curriculum'} lesson for ${effectiveLesson?.grade || 'students'} on LevelSpace.`,
  );

  const toggleBlock = (blockId: string) => {
    setOpenBlocks((current) => current.includes(blockId) ? current.filter((item) => item !== blockId) : [...current, blockId]);
  };

  const focusBlock = (blockId: string) => {
    setOpenBlocks((current) => current.includes(blockId) ? current : [...current, blockId]);
    setTimeout(() => {
      document.getElementById(blockId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleQuizAnswer = (blockIndex: number, option: string, correctAnswer: string) => {
    if (quizAnswered[blockIndex]) return;
    setQuizSelectedOption((current) => ({ ...current, [blockIndex]: option }));
    setQuizAnswered((current) => ({ ...current, [blockIndex]: true }));
    setQuizCorrect((current) => ({ ...current, [blockIndex]: option === correctAnswer }));
  };

  const continueToNext = () => {
    const nextIndex = blocks.findIndex((_, index) => !openBlocks.includes(`block-${index}`));
    focusBlock(`block-${nextIndex >= 0 ? nextIndex : 0}`);
  };

  const markLessonComplete = async () => {
    if (lesson?.id) {
      await db.lessons.update(lesson.id, { status: 'done' });
    }
    navigate('/dashboard');
  };

  if (isLoading && !effectiveLesson) {
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
        keywords={[effectiveLesson.title, effectiveLesson.subject, effectiveLesson.grade, lessonDomainName, 'LevelSpace'].filter(Boolean).join(', ')}
        type="article"
      />

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 pb-24 lg:grid-cols-[minmax(0,1fr)_280px]" dir={contentDir}>
        <section className="min-w-0 space-y-6">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            {t('back_to_dashboard')}
          </button>

          <header className="rounded-3xl border border-surface-mid bg-paper p-6 shadow-sm md:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {effectiveLesson.grade && <span className="pill pill--info">{effectiveLesson.grade}</span>}
              {effectiveLesson.subject && <span className="pill pill--neutral">{effectiveLesson.subject}</span>}
              {lessonDomainName && <span className="pill pill--success">{lessonDomainName}</span>}
              <span className={validationBadgeClass}>{validationLabel}</span>
            </div>

            <h1 className="max-w-4xl text-3xl font-bold leading-tight text-ink md:text-5xl">{effectiveLesson.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted md:text-base">
              {effectiveLesson.subtitle || `${blocks.length || 1} learning section${blocks.length === 1 ? '' : 's'} · guided practice`}
            </p>

            <div className={`mt-4 text-xs font-medium ${lessonHasPreferredValidation ? 'text-success' : 'text-warning'}`}>
              {lessonHasPreferredValidation ? 'Validated for student use.' : 'Draft lesson awaiting curriculum validation.'}
            </div>

            {showValidationWarning && (
              <div className="mt-5 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
                This lesson is visible as draft guidance. Treat it as a learning aid until teacher validation is attached.
              </div>
            )}
          </header>

          {domains.length > 0 && (
            <section className="rounded-3xl border border-surface-mid bg-paper p-4 shadow-sm">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Subject outline</p>
                  <h2 className="text-lg font-bold text-ink">Curriculum domains</h2>
                </div>
                <p className="hidden max-w-md text-xs leading-relaxed text-muted md:block">
                  Domains come from Supabase topic metadata. Lesson sections inherit the topic domain; they are not guessed from text.
                </p>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setActiveDomain('all')}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all ${activeDomain === 'all' ? 'bg-ink text-paper' : 'bg-surface-low text-muted hover:text-ink'}`}
                >
                  All {topics.length || ''}
                </button>
                {domains.map((domain) => {
                  const topicCount = topics.filter((topic) => topic.domain_code === domain.code).length;
                  const isCurrentLessonDomain = domain.code === lessonDomainCode;
                  return (
                    <button
                      key={domain.id}
                      onClick={() => setActiveDomain(domain.code)}
                      className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                        activeDomain === domain.code
                          ? 'bg-ink text-paper'
                          : isCurrentLessonDomain
                            ? 'bg-accent-soft text-accent hover:bg-accent hover:text-paper'
                            : 'bg-surface-low text-muted hover:text-ink'
                      }`}
                    >
                      {domain.name} {topicCount > 0 ? topicCount : 0}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === 'content' && showDomainOverview ? (
            <section className="rounded-3xl border border-surface-mid bg-paper p-6 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Domain overview</p>
              <h2 className="mt-1 text-2xl font-bold text-ink">
                {domains.find((domain) => domain.code === activeDomain)?.name || 'Domain'} topics
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                This lesson belongs to <strong className="text-ink">{lessonDomainName || 'its assigned domain'}</strong>. The list below shows the selected domain from the curriculum outline.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {domainTopics.length > 0 ? domainTopics.map((topic) => (
                  <button
                    key={topic.topic_id}
                    onClick={() => navigate(`/lesson/${topic.topic_id}`)}
                    className="rounded-2xl border border-surface-mid bg-surface-low p-4 text-left transition-all hover:border-accent/30 hover:bg-accent/5"
                  >
                    <p className="text-sm font-semibold text-ink">{topic.topic_title}</p>
                    <p className="mt-1 text-xs text-muted">{topic.outline_count || 0} outline item{topic.outline_count === 1 ? '' : 's'}</p>
                  </button>
                )) : (
                  <p className="text-sm text-muted">No topics are attached to this domain yet.</p>
                )}
              </div>
            </section>
          ) : activeTab === 'content' ? (
            <section className="space-y-4">
              {blocks.length > 0 ? blocks.map((block: any, index: number) => {
                const blockId = `block-${index}`;
                return (
                  <div key={blockId} ref={(node) => { blockRefs.current[blockId] = node; }}>
                    <LessonBlock
                      block={block}
                      index={index}
                      expanded={openBlocks.includes(blockId)}
                      onToggle={() => toggleBlock(blockId)}
                      onQuizAnswer={handleQuizAnswer}
                      quizAnswered={quizAnswered}
                      quizCorrect={quizCorrect}
                      quizSelectedOption={quizSelectedOption}
                    />
                  </div>
                );
              }) : (
                <article className="rounded-3xl border border-surface-mid bg-paper p-6 shadow-sm">
                  <LessonMarkdown>{effectiveLesson.content || 'This lesson does not have structured content yet.'}</LessonMarkdown>
                </article>
              )}
            </section>
          ) : null}

          {activeTab === 'quizzes' && (
            <section className="rounded-3xl border border-surface-mid bg-paper p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-xl font-bold text-ink"><HelpCircle className="h-5 w-5 text-accent" /> {t('lesson_quizzes')}</h2>
              {isLoadingExtra ? <Loader2 className="mt-6 h-6 w-6 animate-spin text-accent" /> : quizzes.length > 0 ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {quizzes.map((quiz) => (
                    <div key={quiz.id} className="rounded-2xl border border-surface-mid bg-surface-low p-4">
                      <h3 className="font-bold text-ink">{quiz.title}</h3>
                      <p className="mt-1 text-sm text-muted">{quiz.description}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-5 text-sm text-muted">{t('no_quizzes_for_lesson')}</p>}
            </section>
          )}

          {activeTab === 'exercises' && (
            <section className="rounded-3xl border border-surface-mid bg-paper p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-xl font-bold text-ink"><Dumbbell className="h-5 w-5 text-accent" /> {t('practice_exercises')}</h2>
              {isLoadingExtra ? <Loader2 className="mt-6 h-6 w-6 animate-spin text-accent" /> : exercises.length > 0 ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {exercises.map((exercise) => (
                    <div key={exercise.id} className="rounded-2xl border border-surface-mid bg-surface-low p-4">
                      <h3 className="font-bold text-ink">{exercise.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{exercise.prompt}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-5 text-sm text-muted">{t('no_exercises_for_lesson')}</p>}
            </section>
          )}

          <footer className="flex flex-col gap-3 pt-4 sm:flex-row">
            <button onClick={() => navigate(-1)} className="h-12 flex-1 rounded-xl border border-surface-mid bg-paper text-xs font-bold uppercase tracking-widest text-ink transition-colors hover:bg-surface-low">
              {t('back')}
            </button>
            <button onClick={continueToNext} className="h-12 flex-1 rounded-xl bg-accent text-xs font-bold uppercase tracking-widest text-paper transition-colors hover:bg-accent-hover">
              Continue
            </button>
            <button onClick={markLessonComplete} className="h-12 flex-1 rounded-xl bg-ink text-xs font-bold uppercase tracking-widest text-paper transition-colors hover:bg-accent">
              {t('complete_lesson')}
            </button>
          </footer>
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4">
            <section className="rounded-3xl border border-surface-mid bg-paper p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Lesson outline</p>
              <div className="mt-4 space-y-2">
                {blocks.map((block: any, index: number) => {
                  const blockId = `block-${index}`;
                  return (
                    <button key={blockId} onClick={() => focusBlock(blockId)} className="flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-surface-low">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${openBlocks.includes(blockId) ? 'bg-accent text-paper' : 'bg-surface-low text-muted'}`}>
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-muted">{getPedagogicalLabel(block)}</span>
                        <span className="mt-0.5 block text-sm font-semibold text-ink">{getBlockTitle(block, index)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-surface-mid bg-paper p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Practice</p>
              <div className="mt-3 flex flex-col gap-2">
                <button onClick={() => setActiveTab('content')} className={`rounded-xl px-3 py-2 text-left text-xs font-bold uppercase tracking-widest ${activeTab === 'content' ? 'bg-ink text-paper' : 'bg-surface-low text-muted'}`}>Content</button>
                <button onClick={() => setActiveTab('quizzes')} className={`rounded-xl px-3 py-2 text-left text-xs font-bold uppercase tracking-widest ${activeTab === 'quizzes' ? 'bg-ink text-paper' : 'bg-surface-low text-muted'}`}>Quizzes</button>
                <button onClick={() => setActiveTab('exercises')} className={`rounded-xl px-3 py-2 text-left text-xs font-bold uppercase tracking-widest ${activeTab === 'exercises' ? 'bg-ink text-paper' : 'bg-surface-low text-muted'}`}>Exercises</button>
              </div>
            </section>
          </div>
        </aside>

        <button
          onClick={() => setShowOutlineModal(true)}
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-xs font-bold uppercase tracking-widest text-paper shadow-2xl lg:hidden"
        >
          <List className="h-4 w-4" />
          Outline
        </button>
      </main>

      <Modal isOpen={showOutlineModal} onClose={() => setShowOutlineModal(false)} title="Lesson outline" maxWidth="lg">
        <div className="space-y-3">
          {blocks.map((block: any, index: number) => {
            const blockId = `block-${index}`;
            return (
              <button
                key={blockId}
                onClick={() => {
                  setShowOutlineModal(false);
                  focusBlock(blockId);
                }}
                className="flex w-full items-start gap-3 rounded-2xl border border-surface-mid bg-surface-low p-4 text-left"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-bold text-muted">{index + 1}</span>
                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-muted">{getPedagogicalLabel(block)}</span>
                  <span className="mt-1 block text-sm font-semibold text-ink">{getBlockTitle(block, index)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Modal>
    </Layout>
  );
};
