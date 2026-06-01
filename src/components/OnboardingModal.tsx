import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BookA,
  BookMarked,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChartNoAxesCombined,
  ClipboardCheck,
  Globe,
  GraduationCap,
  Layers,
  LibraryBig,
  Search,
  Sparkles,
  Target,
  WandSparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateProfile, supabase } from '../db/supabase';
import { db } from '../db/db';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete?: () => void;
  inline?: boolean;
}

interface CurriculumEntity {
  id: string;
  name: string;
  code?: string;
}

const VALUE_PREVIEWS = [
  {
    eyebrow: 'Classroom mapped',
    title: 'Your curriculum, organized',
    detail: 'Grade-aware learning path',
    metric: '12 modules',
    icon: Layers,
    accent: 'text-blue-300',
    tile: 'bg-blue-400/15',
  },
  {
    eyebrow: 'AI guidance ready',
    title: 'Lessons built around you',
    detail: 'Smart explanations and practice',
    metric: 'Always tuned',
    icon: WandSparkles,
    accent: 'text-violet-300',
    tile: 'bg-violet-400/15',
  },
  {
    eyebrow: 'Progress visible',
    title: 'Know your next move',
    detail: 'Focus, mastery, and review signals',
    metric: '+18% mastery',
    icon: ChartNoAxesCombined,
    accent: 'text-emerald-300',
    tile: 'bg-emerald-400/15',
  },
] as const;

const normalizeLabel = (value = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function getCycleIcon(cycleName: string) {
  const normalized = normalizeLabel(cycleName);

  if (normalized.includes('primaire')) return BookA;
  if (normalized.includes('college')) return LibraryBig;
  if (normalized.includes('lycee')) return GraduationCap;
  return BrainCircuit;
}

function shouldShowTrackSelector(cycleName = '', gradeName = '') {
  const label = normalizeLabel(`${cycleName} ${gradeName}`);
  return label.includes('lycee') || label.includes('bac') || label.includes('tronc commun');
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete,
  inline = false,
}) => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [cycles, setCycles] = useState<CurriculumEntity[]>([]);
  const [grades, setGrades] = useState<CurriculumEntity[]>([]);
  const [subjects, setSubjects] = useState<CurriculumEntity[]>([]);
  const [tracks, setTracks] = useState<CurriculumEntity[]>([]);
  const [options, setOptions] = useState<CurriculumEntity[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [subjectQuery, setSubjectQuery] = useState('');
  const [loadingInitialData, setLoadingInitialData] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeValueIndex, setActiveValueIndex] = useState(0);
  const [showWelcomeCta, setShowWelcomeCta] = useState(false);

  const selectedCycle = cycles.find((cycle) => cycle.id === selectedCycleId);
  const selectedGrade = grades.find((grade) => grade.id === selectedGradeId);
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId);
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId);
  const selectedOption = options.find((option) => option.id === selectedOptionId);
  const requiresTrack = shouldShowTrackSelector(selectedCycle?.name, selectedGrade?.name);
  const userName = profile?.full_name || user?.email?.split('@')[0] || 'Explorer';

  const stepLabels = requiresTrack
    ? ['Welcome', 'Level', 'Grade', 'Subject', 'Track', 'Language', 'Ready']
    : ['Welcome', 'Level', 'Grade', 'Subject', 'Ready'];
  const totalSteps = stepLabels.length - 1;
  const progress = Math.round((step / totalSteps) * 100);

  const filteredSubjects = useMemo(() => {
    const query = normalizeLabel(subjectQuery.trim());
    if (!query) return subjects;
    return subjects.filter((subject) => normalizeLabel(subject.name).includes(query));
  }, [subjectQuery, subjects]);

  useEffect(() => {
    if (!isOpen && !inline) return;

    const interval = window.setInterval(() => {
      setActiveValueIndex((current) => (current + 1) % VALUE_PREVIEWS.length);
    }, 2800);

    return () => window.clearInterval(interval);
  }, [inline, isOpen]);

  useEffect(() => {
    if (step !== 0 || (!isOpen && !inline)) {
      setShowWelcomeCta(false);
      return;
    }

    const timeout = window.setTimeout(() => setShowWelcomeCta(true), 2000);
    return () => window.clearTimeout(timeout);
  }, [inline, isOpen, step]);

  useEffect(() => {
    if (!isOpen && !inline) return;

    const fetchInitialData = async () => {
      setLoadingInitialData(true);
      setErrorMessage('');

      const [cyclesResult, tracksResult, optionsResult] = await Promise.all([
        supabase.from('cycles').select('*').order('cycle_order'),
        supabase.from('bac_tracks').select('*').order('track_order'),
        supabase.from('bac_international_options').select('*'),
      ]);

      const firstError = cyclesResult.error || tracksResult.error || optionsResult.error;
      if (firstError) {
        setErrorMessage('We could not load your academic options. Please refresh and try again.');
      }

      setCycles(cyclesResult.data || []);
      setTracks(tracksResult.data || []);
      setOptions(optionsResult.data || []);
      setLoadingInitialData(false);
    };

    fetchInitialData();
  }, [inline, isOpen]);

  useEffect(() => {
    if (!selectedCycleId) {
      setGrades([]);
      return;
    }

    supabase
      .from('grades')
      .select('*')
      .eq('cycle_id', selectedCycleId)
      .order('grade_order')
      .then(({ data, error }) => {
        if (error) setErrorMessage('We could not load grades for this level. Please try again.');
        setGrades(data || []);
      });
  }, [selectedCycleId]);

  useEffect(() => {
    if (!selectedGradeId) {
      setSubjects([]);
      return;
    }

    const fetchSubjects = async () => {
      setLoadingSubjects(true);
      setSubjectQuery('');
      const { data, error } = await supabase
        .from('grade_subjects')
        .select('subjects(id, name, code)')
        .eq('grade_id', selectedGradeId);

      if (error) setErrorMessage('We could not load subjects for this grade. You can continue without one.');
      setSubjects(data?.map((item: any) => item.subjects).filter(Boolean) || []);
      setLoadingSubjects(false);
    };

    fetchSubjects();
  }, [selectedGradeId]);

  const handleCycleChange = (id: string) => {
    setSelectedCycleId(id);
    setSelectedGradeId('');
    setSelectedSubjectId('');
    setSelectedTrackId('');
    setSelectedOptionId('');
    setErrorMessage('');
  };

  const handleGradeChange = (id: string) => {
    setSelectedGradeId(id);
    setSelectedSubjectId('');
    setSelectedTrackId('');
    setSelectedOptionId('');
    setErrorMessage('');
  };

  const isContinueDisabled =
    saving ||
    (step === 1 && !selectedCycleId) ||
    (step === 2 && !selectedGradeId) ||
    (step === 4 && requiresTrack && tracks.length > 0 && !selectedTrackId) ||
    (step === 5 && requiresTrack && options.length > 0 && !selectedOptionId);

  const handleComplete = async () => {
    if (!selectedGradeId || saving) return;

    setSaving(true);
    setErrorMessage('');

    try {
      localStorage.setItem('selected_country', 'Morocco');
      localStorage.setItem('selected_cycle', selectedCycle?.name || '');
      localStorage.setItem('selected_grade', selectedGrade?.name || '');
      localStorage.setItem('has_completed_onboarding', 'true');
      if (selectedTrack) localStorage.setItem('selected_bac_track', selectedTrack.id);
      if (selectedOption) localStorage.setItem('selected_option', selectedOption.id);

      await db.settings.bulkPut([
        { key: 'selected_country', value: 'Morocco' },
        { key: 'selected_cycle', value: selectedCycle?.name || '' },
        { key: 'selected_grade', value: selectedGrade?.name || '' },
        { key: 'has_completed_onboarding', value: 'true' },
        ...(selectedTrack ? [{ key: 'selected_bac_track', value: selectedTrack.id }] : []),
        ...(selectedOption ? [{ key: 'selected_option', value: selectedOption.id }] : []),
      ]);

      if (user) {
        try {
          await updateProfile(user.id, {
            onboarding_completed: true,
            selected_grade: selectedGrade?.name || '',
            selected_bac_track: selectedTrackId || null,
          });
        } catch (profileError) {
          console.error('Failed to persist onboarding profile:', profileError);
        }
      }

      onComplete?.();
      if (inline) navigate('/modules');
    } catch (error) {
      console.error('Failed to persist onboarding:', error);
      setErrorMessage('Your setup could not be saved. Please try again.');
      setSaving(false);
    }
  };

  if (!isOpen && !inline) return null;

  const renderStepHeading = (
    icon: React.ReactNode,
    eyebrow: string,
    title: string,
    description: string,
  ) => (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/10 bg-accent/5 text-accent">
        {icon}
      </div>
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
        <h2 className="text-lg font-bold text-ink sm:text-xl">{title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted sm:text-sm">{description}</p>
      </div>
    </div>
  );

  const selectionCardClass = (selected: boolean) =>
    `group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-accent/30 ${
      selected
        ? 'border-accent bg-accent/5 shadow-sm'
        : 'border-surface-mid bg-paper hover:border-accent/30 hover:bg-accent/[0.02]'
    }`;

  const activeValue = VALUE_PREVIEWS[activeValueIndex];
  const ActiveValueIcon = activeValue.icon;

  const content = (
    <div className="relative grid min-h-[480px] max-h-[calc(100vh-1.5rem)] lg:min-h-[520px] lg:grid-cols-[0.78fr_1.22fr]">
      <aside className="relative hidden overflow-hidden bg-slate-950 p-5 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-20 -top-16 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-14 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="relative">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-lg shadow-accent/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">Levelspace</span>
          </div>
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-blue-300">Your learning command center</p>
          <h2 className="max-w-xs text-xl font-bold leading-tight">Build a space that understands where you are going.</h2>
          <p className="mt-2 max-w-xs text-[11px] leading-relaxed text-white/60">
            A few quick choices shape your curriculum, classrooms, and AI guidance from the very first lesson.
          </p>
        </div>

        <div className="relative my-3">
          <motion.div
            key={activeValue.eyebrow}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-xl border border-white/10 bg-white/[0.06] p-2.5 shadow-xl shadow-black/10"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${activeValue.tile} ${activeValue.accent}`}>
                <ActiveValueIcon className="h-4 w-4" />
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/60">
                Live preview
              </span>
            </div>
            <p className={`text-[9px] font-bold uppercase tracking-[0.16em] ${activeValue.accent}`}>{activeValue.eyebrow}</p>
            <p className="mt-1 text-sm font-bold text-white">{activeValue.title}</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  key={`${activeValue.eyebrow}-progress`}
                  initial={{ width: '18%' }}
                  animate={{ width: '82%' }}
                  transition={{ duration: 2.4, ease: 'easeOut' }}
                  className="h-full rounded-full bg-blue-400"
                />
              </div>
              <span className="text-[9px] font-bold text-white/60">{activeValue.metric}</span>
            </div>
          </motion.div>
          <div className="mt-2 flex justify-center gap-1.5">
            {VALUE_PREVIEWS.map((preview, index) => (
              <span key={preview.eyebrow} className={`h-1 rounded-full transition-all ${index === activeValueIndex ? 'w-5 bg-blue-300' : 'w-1 bg-white/20'}`} />
            ))}
          </div>
        </div>

        <div className="relative space-y-2">
          {[
            ['01', 'Curriculum-aware classrooms'],
            ['02', 'Lessons matched to your grade'],
            ['03', 'AI guidance tuned to your path'],
          ].map(([number, label]) => (
            <div key={number} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-[10px] font-bold tracking-widest text-blue-300">{number}</span>
              <span className="text-xs font-medium text-white/80">{label}</span>
            </div>
          ))}
        </div>
      </aside>

      <section className="relative flex min-w-0 flex-col overflow-hidden bg-paper">
        <div className="border-b border-surface-mid px-4 pb-3 pt-4 sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="font-display text-sm font-bold text-ink">Levelspace</span>
            </div>
            <p className="ml-auto text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              {step === 0 ? 'Personalize your space' : `Step ${Math.min(step, totalSteps)} of ${totalSteps}`}
            </p>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-surface-mid">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="mt-2.5 hidden items-center justify-between gap-1 sm:flex">
            {stepLabels.map((label, index) => (
              <div key={label} className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${index <= step ? 'text-accent' : 'text-muted/60'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${index <= step ? 'bg-accent' : 'bg-surface-mid'}`} />
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <>
            {step === 0 && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-1 flex-col justify-center"
              >
                <motion.div
                  key={`${activeValue.eyebrow}-welcome`}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35 }}
                  className="mb-3 hidden items-center gap-3 self-end rounded-2xl border border-surface-mid bg-surface-low/70 px-3 py-2.5 shadow-sm sm:flex"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <ActiveValueIcon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-accent">{activeValue.eyebrow}</span>
                    <span className="mt-0.5 block text-xs font-bold text-ink">{activeValue.detail}</span>
                  </span>
                  <ClipboardCheck className="ml-2 h-4 w-4 text-emerald-500" />
                </motion.div>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <WandSparkles className="h-5 w-5" />
                </div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Less than one minute</p>
                <h1 className="max-w-lg text-[1.35rem] font-bold leading-tight text-ink sm:text-[1.7rem]">
                  Welcome, <span className="text-accent">{userName}</span>.
                  <br />
                  Let&apos;s shape your space.
                </h1>
                <p className="mt-2 max-w-md text-xs leading-relaxed text-muted">
                  Tell us your current academic level. Levelspace will use it to organize your classrooms and make every AI suggestion more relevant.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {['Your level', 'Your grade', 'Your focus'].map((label) => (
                    <div key={label} className="rounded-xl border border-surface-mid bg-surface-low px-3 py-2 text-[11px] font-semibold text-ink-secondary">
                      <Check className="mb-1.5 h-4 w-4 text-accent" />
                      {label}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="cycle" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                {renderStepHeading(<Layers className="h-5 w-5" />, 'Academic level', 'Where are you studying now?', 'Choose the stage that best matches your current studies.')}
                {loadingInitialData ? (
                  <div className="rounded-2xl border border-surface-mid bg-surface-low p-5 text-sm text-muted">Loading academic levels...</div>
                ) : (
                  <div className="grid max-h-[260px] gap-2 overflow-y-auto pr-1 custom-scrollbar sm:max-h-[300px]">
                    {cycles.map((cycle) => {
                      const Icon = getCycleIcon(cycle.name);
                      const selected = selectedCycleId === cycle.id;
                      return (
                        <button type="button" key={cycle.id} aria-pressed={selected} onClick={() => handleCycleChange(cycle.id)} className={selectionCardClass(selected)}>
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-accent text-white' : 'bg-surface-low text-ink-secondary'}`}>
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="flex-1 text-sm font-bold leading-snug text-ink">{cycle.name}</span>
                          {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="grade" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                {renderStepHeading(<GraduationCap className="h-5 w-5" />, 'Your grade', 'Which year are you in?', 'This anchors your lessons to the right curriculum and difficulty level.')}
                <div className="grid max-h-[270px] grid-cols-2 gap-2 overflow-y-auto pr-1 custom-scrollbar sm:max-h-[310px]">
                  {grades.map((grade) => {
                    const selected = selectedGradeId === grade.id;
                    return (
                      <button type="button" key={grade.id} aria-pressed={selected} onClick={() => handleGradeChange(grade.id)} className={`${selectionCardClass(selected)} justify-center px-3 text-center`}>
                        <span className={`text-sm font-bold ${selected ? 'text-accent' : 'text-ink'}`}>{grade.name}</span>
                        {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="subject" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                {renderStepHeading(<BookMarked className="h-5 w-5" />, 'Optional focus', 'Choose a primary subject', 'Pick one to personalize your starting view, or skip this for now.')}
                {subjects.length > 5 && (
                  <label className="mb-3 flex items-center gap-2 rounded-xl border border-surface-mid bg-paper px-3 py-2.5 focus-within:border-accent/40">
                    <Search className="h-4 w-4 text-muted" />
                    <input value={subjectQuery} onChange={(event) => setSubjectQuery(event.target.value)} placeholder="Search subjects" className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted" />
                  </label>
                )}
                {loadingSubjects ? (
                  <div className="rounded-2xl border border-surface-mid bg-surface-low p-5 text-sm text-muted">Loading subjects...</div>
                ) : subjects.length === 0 ? (
                  <div className="rounded-2xl border border-surface-mid bg-surface-low p-5 text-sm leading-relaxed text-muted">
                    No subjects are configured for this grade yet. You can continue and add your classrooms later.
                  </div>
                ) : (
                  <div className="grid max-h-[240px] gap-2 overflow-y-auto pr-1 sm:max-h-[280px] sm:grid-cols-2 custom-scrollbar">
                    {filteredSubjects.map((subject) => {
                      const selected = selectedSubjectId === subject.id;
                      return (
                        <button type="button" key={subject.id} aria-pressed={selected} onClick={() => setSelectedSubjectId(selected ? '' : subject.id)} className={selectionCardClass(selected)}>
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-accent text-white' : 'bg-surface-low text-muted'}`}>
                            <BookOpen className="h-4 w-4" />
                          </span>
                          <span className="flex-1 truncate text-sm font-bold text-ink">{subject.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {step === 4 && requiresTrack && (
              <motion.div key="track" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                {renderStepHeading(<Target className="h-5 w-5" />, 'Specialty', 'Choose your academic track', 'Your track helps Levelspace surface the most relevant lessons and exam preparation.')}
                <div className="grid max-h-[270px] gap-2 overflow-y-auto pr-1 custom-scrollbar sm:max-h-[310px]">
                  {tracks.length === 0 ? (
                    <div className="rounded-2xl border border-surface-mid bg-surface-low p-5 text-sm text-muted">No tracks are configured yet. You can continue.</div>
                  ) : tracks.map((track) => {
                    const selected = selectedTrackId === track.id;
                    return (
                      <button type="button" key={track.id} aria-pressed={selected} onClick={() => setSelectedTrackId(track.id)} className={selectionCardClass(selected)}>
                        <span className="flex-1 text-sm font-bold text-ink">{track.name}</span>
                        {selected && <CheckCircle2 className="h-5 w-5 text-accent" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === 5 && requiresTrack && (
              <motion.div key="language" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
                {renderStepHeading(<Globe className="h-5 w-5" />, 'Language option', 'How do you study science?', 'Choose the language used for your scientific subjects.')}
                <div className="grid gap-3">
                  {options.length === 0 ? (
                    <div className="rounded-2xl border border-surface-mid bg-surface-low p-5 text-sm text-muted">No language options are configured yet. You can continue.</div>
                  ) : options.map((option) => {
                    const selected = selectedOptionId === option.id;
                    return (
                      <button type="button" key={option.id} aria-pressed={selected} onClick={() => setSelectedOptionId(option.id)} className={selectionCardClass(selected)}>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-low text-muted"><Globe className="h-5 w-5" /></span>
                        <span className="flex-1 text-sm font-bold text-ink">{option.name}</span>
                        {selected && <CheckCircle2 className="h-5 w-5 text-accent" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === totalSteps && (
              <motion.div key="ready" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600">You are ready</p>
                <h2 className="text-2xl font-bold leading-tight text-ink sm:text-3xl">Your learning space now has a starting point.</h2>
                <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">Your classrooms and AI guidance will begin with this academic context. Preferences can still grow with you.</p>
                <div className="mt-4 rounded-xl border border-surface-mid bg-surface-low p-3">
                  {[
                    ['Level', selectedCycle?.name],
                    ['Grade', selectedGrade?.name],
                    ['Focus', selectedSubject?.name || 'Add later'],
                    ...(selectedTrack ? [['Track', selectedTrack.name]] : []),
                    ...(selectedOption ? [['Language', selectedOption.name]] : []),
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 border-b border-surface-mid py-2 last:border-0">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
                      <span className="max-w-[68%] text-right text-sm font-bold text-ink">{value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </>

          {errorMessage && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{errorMessage}</p>}

          {step > 0 && <div className="mt-auto flex items-center justify-between gap-3 border-t border-surface-mid pt-4">
            {step > 0 ? (
              <button type="button" onClick={() => setStep((current) => Math.max(current - 1, 0))} className="ls-button-ghost">
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : <span />}

            {step < totalSteps ? (
              <button type="button" disabled={isContinueDisabled} onClick={() => setStep((current) => Math.min(current + 1, totalSteps))} className="ls-button-primary px-4 py-2.5">
                {step === 3 ? 'Continue' : 'Next step'}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" disabled={saving} onClick={handleComplete} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? 'Saving your space...' : 'Enter Levelspace'}
                {!saving && <ArrowRight className="h-4 w-4" />}
              </button>
            )}
          </div>}
        </div>

        {step === 0 && showWelcomeCta && (
          <motion.div
            role="dialog"
            aria-label="Create your Levelspace"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          >
            <div className="w-full max-w-sm rounded-2xl border border-amber-300/50 bg-amber-50 p-4 text-slate-950 shadow-2xl shadow-black/30 sm:p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-slate-950 shadow-md shadow-amber-500/30">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-700">Your space is waiting</p>
              <h2 className="mt-1 text-xl font-bold leading-tight">Ready to make Levelspace yours?</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Give us your academic level and we will personalize your classrooms, lessons, and AI guidance.
              </p>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/25 transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2"
              >
                Create your space now
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </section>
    </div>
  );

  if (inline) {
    return (
      <div className="relative mx-auto my-4 w-full max-w-[54rem] overflow-hidden rounded-2xl border border-surface-mid bg-paper shadow-xl">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-2 backdrop-blur-sm sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="my-auto w-full max-w-[54rem] overflow-hidden rounded-2xl border border-white/10 bg-paper shadow-2xl"
      >
        {content}
      </motion.div>
    </div>
  );
};
