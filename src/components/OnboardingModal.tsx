import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  BookA,
  BrainCircuit,
  CheckCircle2,
  X,
  GraduationCap,
  Layers,
  LibraryBig,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase, updateProfile } from '../db/supabase';
import { db } from '../db/db';
import {
  CurriculumGrade,
  CurriculumSubject,
  debugVerifyOnboardingCurriculum,
  getGrades,
  getSubjectsForGrade,
  validateGradeSubjectPair,
} from '../services/curriculumService';
import { SUPPORTED_SCOPE_EMPTY_MESSAGE } from '../config/supportedGrades';
import { getAcademicIdentity, isMoroccanBacIdentity } from '../services/academicIdentity';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete?: () => void;
  inline?: boolean;
}

const cycleIcon = (cycleName: string) => {
  const normalized = cycleName.toLowerCase();
  if (normalized.includes('coll') || normalized.includes('middle')) return LibraryBig;
  if (normalized.includes('lyc') || normalized.includes('high') || normalized.includes('bac')) return GraduationCap;
  return BrainCircuit;
};

const groupGradesByCycle = (grades: CurriculumGrade[]) => {
  const groups = new Map<string, { id: string; name: string; grades: CurriculumGrade[] }>();

  for (const grade of grades) {
    const cycleId = grade.cycle?.id || grade.cycle_id || 'uncategorized';
    const cycleName = grade.cycle?.name || 'Other Grades';
    const group = groups.get(cycleId) || { id: cycleId, name: cycleName, grades: [] };
    group.grades.push(grade);
    groups.set(cycleId, group);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    grades: group.grades.sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }),
    ),
  }));
};

const isDev = () => import.meta.env.DEV;

type BacTrack = {
  id: string;
  name: string;
  grade_id?: string | null;
};

type InstructionOption = {
  id: string;
  name: string;
  option_code?: string | null;
};

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete, inline = false }) => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [grades, setGrades] = useState<CurriculumGrade[]>([]);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedBacTrackId, setSelectedBacTrackId] = useState('');
  const [selectedInstructionOptionId, setSelectedInstructionOptionId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [bacTracks, setBacTracks] = useState<BacTrack[]>([]);
  const [instructionOptions, setInstructionOptions] = useState<InstructionOption[]>([]);
  const [isLoadingGrades, setIsLoadingGrades] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isLoadingInstructionOptions, setIsLoadingInstructionOptions] = useState(false);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const userName = profile?.full_name || (user?.email ? user.email.split('@')[0] : 'Explorer');
  const isActive = isOpen || inline;
  const cycleGroups = useMemo(() => groupGradesByCycle(grades), [grades]);
  const selectedCycle = cycleGroups.find((cycle) => cycle.id === selectedCycleId) || null;
  const selectedGrade = grades.find((grade) => grade.id === selectedGradeId) || null;
  const visibleBacTracks = bacTracks.filter((track) => !track.grade_id || track.grade_id === selectedGradeId);
  const selectedBacTrack = bacTracks.find((track) => track.id === selectedBacTrackId) || null;
  const selectedInstructionOption = instructionOptions.find((option) => option.id === selectedInstructionOptionId) || null;
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) || null;
  const requiresBacTrack = isMoroccanBacIdentity(selectedGrade?.cycle?.country || 'Morocco', selectedGrade?.name);
  const requiresInstructionOption = requiresBacTrack && instructionOptions.length > 0;
  const instructionOptionStep = 4;
  const subjectStep = requiresBacTrack ? (requiresInstructionOption ? 5 : 4) : 3;
  const totalSteps = subjectStep + 1;

  useEffect(() => {
    if (!isActive) return;

    let cancelled = false;
    setIsLoadingGrades(true);
    setErrorMessage('');

    getGrades()
      .then((rows) => {
        if (cancelled) return;
        setGrades(rows);
        if (isDev() && rows.length === 0) {
          console.warn('[onboarding] Empty grade list from Supabase.');
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[onboarding] Failed to load Supabase grades:', error);
        setErrorMessage('Unable to load grades from Supabase.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingGrades(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    let cancelled = false;
    setIsLoadingTracks(true);

    supabase
      .from('tracks')
      .select('id, name, grade_id')
      .order('track_order', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) throw error;
        setBacTracks(
          (data || [])
            .map((track: any) => ({
              id: String(track.id || '').trim(),
              name: String(track.name || '').trim(),
              grade_id: track.grade_id ? String(track.grade_id) : null,
            }))
            .filter((track) => track.id && track.name),
        );
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[onboarding] Failed to load tracks from Supabase:', error);
        setErrorMessage('Unable to load academic tracks from Supabase.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTracks(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !requiresBacTrack || !selectedBacTrackId) {
      setInstructionOptions([]);
      setSelectedInstructionOptionId('');
      return;
    }

    let cancelled = false;
    setIsLoadingInstructionOptions(true);
    supabase
      .from('instruction_options')
      .select('id, name, option_code')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) throw error;
        setInstructionOptions((data || []).map((option: any) => ({
          id: String(option.id || '').trim(),
          name: String(option.name || '').trim(),
          option_code: option.option_code ? String(option.option_code) : null,
        })).filter((option) => option.id && option.name));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[onboarding] Failed to load instruction options:', error);
        setErrorMessage('Unable to load instruction options from Supabase.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingInstructionOptions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isActive, requiresBacTrack, selectedBacTrackId]);

  useEffect(() => {
    if (!selectedGradeId) {
      setSubjects([]);
      setSelectedSubjectId('');
      return;
    }

    if (requiresBacTrack && !selectedBacTrackId) {
      setSubjects([]);
      setSelectedSubjectId('');
      return;
    }

    const grade = grades.find((row) => row.id === selectedGradeId);
    let cancelled = false;
    setIsLoadingSubjects(true);
    setErrorMessage('');
    setSelectedSubjectId('');

    const loadSubjects = async () => {
      const rows = await getSubjectsForGrade(selectedGradeId);
      if (!requiresBacTrack || !selectedBacTrackId) return rows;

      const { data, error } = await supabase
        .from('track_subjects')
        .select('subject_id')
        .eq('track_id', selectedBacTrackId);

      if (error) throw error;

      const allowedSubjectIds = new Set((data || []).map((row: any) => String(row.subject_id || '').trim()));
      if (allowedSubjectIds.size === 0) return rows;
      return rows.filter((subject) => allowedSubjectIds.has(subject.id));
    };

    loadSubjects()
      .then(async (rows) => {
        if (cancelled) return;
        setSubjects(rows);

        if (grade) {
          await debugVerifyOnboardingCurriculum(grade);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[onboarding] Failed to load Supabase subjects for grade:', {
          gradeId: selectedGradeId,
          error,
        });
        setErrorMessage('Unable to load subjects for this grade.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSubjects(false);
      });

    return () => {
      cancelled = true;
    };
  }, [grades, requiresBacTrack, selectedBacTrackId, selectedGradeId]);

  const handleSelectCycle = (cycleId: string) => {
    setSelectedCycleId(cycleId);
    setSelectedGradeId('');
    setSelectedBacTrackId('');
    setSelectedInstructionOptionId('');
    setSelectedSubjectId('');
    setSubjects([]);
    setErrorMessage('');
  };

  const handleSelectGrade = (grade: CurriculumGrade) => {
    setSelectedGradeId(grade.id);
    setSelectedBacTrackId('');
    setSelectedInstructionOptionId('');
    setSelectedSubjectId('');
    setSubjects([]);
    setErrorMessage('');
  };

  const handleSelectTrack = (trackId: string) => {
    setSelectedBacTrackId(trackId);
    setSelectedInstructionOptionId('');
    setSelectedSubjectId('');
    setSubjects([]);
    setErrorMessage('');
  };

  const handleNext = () => setStep((current) => Math.min(current + 1, totalSteps));
  const handleBack = () => setStep((current) => Math.max(current - 1, 0));
  const finishOnboarding = () => {
    onComplete?.();
    if (inline) navigate('/modules');
  };

  const persistSetting = async (key: string, value: string) => {
    localStorage.setItem(key, value);
    await db.settings.put({ key, value });
  };

  const handleSkip = async () => {
    setIsSaving(true);
    setErrorMessage('');

    try {
      await persistSetting('has_completed_onboarding', 'true');

      if (user) {
        try {
          await updateProfile(user.id, { onboarding_completed: true });
        } catch (error: any) {
          console.error('Failed to persist onboarding skip to database:', error.message);
        }
      }

      finishOnboarding();
    } catch (error) {
      console.error('[onboarding] Failed to skip onboarding:', error);
      setErrorMessage('Unable to skip onboarding right now.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedGrade || !selectedSubject) {
      setErrorMessage('Select a valid grade and subject before continuing.');
      return;
    }
    if (requiresBacTrack && !selectedBacTrackId) {
      setErrorMessage('Select the academic track before continuing.');
      return;
    }
    if (requiresInstructionOption && !selectedInstructionOptionId) {
      setErrorMessage('Select the instruction option before continuing.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      let isValidPair = await validateGradeSubjectPair(selectedGrade.id, selectedSubject.id);
      if (requiresBacTrack && selectedBacTrackId) {
        const { data: trackSubject, error: trackSubjectError } = await supabase
          .from('track_subjects')
          .select('subject_id')
          .eq('track_id', selectedBacTrackId)
          .eq('subject_id', selectedSubject.id)
          .maybeSingle();
        if (trackSubjectError) throw trackSubjectError;
        isValidPair = Boolean(trackSubject) || isValidPair;
      }
      if (!isValidPair) {
        if (isDev()) {
          console.warn('[onboarding] Rejected invalid grade/subject pair.', {
            grade: { id: selectedGrade.id, name: selectedGrade.name },
            subject: { id: selectedSubject.id, name: selectedSubject.name },
          });
        }
        setErrorMessage('This subject is not configured for the selected grade.');
        return;
      }

      const selectedCycleName = selectedGrade.cycle?.name || selectedCycle?.name || '';
      await persistSetting('selected_country', selectedGrade.cycle?.country || 'Morocco');
      await persistSetting('selected_cycle_id', selectedGrade.cycle?.id || selectedGrade.cycle_id || '');
      await persistSetting('selected_cycle', selectedCycleName);
      await persistSetting('selected_grade_id', selectedGrade.id);
      await persistSetting('selected_grade', selectedGrade.name);
      await persistSetting('selected_subject_id', selectedSubject.id);
      await persistSetting('selected_subject', selectedSubject.name);
      await persistSetting('has_completed_onboarding', 'true');

      const identity = getAcademicIdentity({
        country: selectedGrade.cycle?.country || 'Morocco',
        gradeId: selectedGrade.id,
        gradeName: selectedGrade.name,
        trackId: selectedBacTrackId,
        instructionOptionId: selectedInstructionOptionId,
        subjectId: selectedSubject.id,
      });
      await persistSetting('selected_bac_track', identity.trackId);
      await persistSetting('selected_bac_int_option', identity.instructionOptionId);
      // Legacy readers may still consult selected_option; keep it as a fallback only.
      await persistSetting('selected_option', identity.instructionOptionId);

      if (user) {
        try {
          await updateProfile(user.id, {
            onboarding_completed: true,
            grade_id: selectedGrade.id,
            track_id: identity.trackId || null,
            instruction_option_id: identity.instructionOptionId || null,
            selected_grade: selectedGrade.name,
            selected_option: identity.instructionOptionId || null,
            selected_bac_track: identity.trackId || null,
          });
        } catch (error: any) {
          console.error('Failed to persist onboarding to database:', error.message);
        }
      }

      finishOnboarding();
    } catch (error) {
      console.error('[onboarding] Failed to save curriculum selection:', error);
      setErrorMessage('Unable to save onboarding selection.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isActive) return null;

  const canContinue =
    (step === 0) ||
    (step === 1 && Boolean(selectedCycleId)) ||
    (step === 2 && Boolean(selectedGradeId)) ||
    (requiresBacTrack && step === 3 && Boolean(selectedBacTrackId)) ||
    (requiresInstructionOption && step === instructionOptionStep && Boolean(selectedInstructionOptionId)) ||
    (step === subjectStep && Boolean(selectedSubjectId));

  return (
    <div
      className={
        inline
          ? 'relative mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center p-4'
          : 'fixed inset-0 z-[200] flex items-center justify-center bg-ink/40 p-4'
      }
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-ink/10 bg-paper shadow-md"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent" />
        <button
          type="button"
          onClick={handleSkip}
          disabled={isSaving}
          className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-paper text-muted shadow-sm transition-all hover:bg-surface-low hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Skip onboarding"
          title="Skip onboarding"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="absolute left-0 top-0 h-1 w-full bg-ink/5">
          <motion.div
            className="h-full bg-accent"
            initial={{ width: '0%' }}
            animate={{ width: `${(step / totalSteps) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="flex min-h-[425px] flex-col p-6 md:p-10">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step-0"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-1 flex-col items-center justify-center space-y-8 text-center"
              >
                <div className="relative">
                  <div className="absolute -inset-4 animate-pulse rounded-full bg-accent/20 blur-2xl" />
                  <div className="relative flex h-20 w-20 rotate-3 items-center justify-center rounded-3xl bg-accent text-paper shadow-md">
                    <Sparkles className="h-8 w-8" />
                  </div>
                </div>
                <div className="space-y-4">
                  <h1 className="text-xl font-bold leading-[1.1] tracking-tight text-ink sm:text-3xl">
                    Welcome, <span className="capitalize text-accent">{userName}</span>
                    <br />
                    Let's personalize your space
                  </h1>
                  <p className="mx-auto max-w-sm text-sm font-medium leading-relaxed text-muted">
                    We'll load your exact academic path from Supabase.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-1 flex-col"
              >
                <StepHeader icon={<Layers className="h-5 w-5" />} title="Academic Phase" body="Select a cycle from Supabase." />
                {isLoadingGrades ? (
                  <LoadingState label="Loading grades..." />
                ) : cycleGroups.length === 0 ? (
                  <EmptyState message={SUPPORTED_SCOPE_EMPTY_MESSAGE} />
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {cycleGroups.map((cycle) => {
                      const Icon = cycleIcon(cycle.name);
                      return (
                        <button
                          key={cycle.id}
                          onClick={() => handleSelectCycle(cycle.id)}
                          className={`group flex items-start gap-4 rounded-[1.5rem] border-2 p-5 text-left transition-all ${
                            selectedCycleId === cycle.id
                              ? 'scale-[1.02] border-accent bg-accent/5 shadow-sm shadow-accent/10'
                              : 'border-transparent bg-surface-low hover:border-accent/30 hover:bg-paper hover:shadow-md'
                          }`}
                        >
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                              selectedCycleId === cycle.id
                                ? 'bg-accent text-paper'
                                : 'bg-surface-mid text-ink-secondary group-hover:bg-accent/10 group-hover:text-accent'
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className={`mb-1 text-base font-bold leading-tight ${selectedCycleId === cycle.id ? 'text-accent' : 'text-ink'}`}>
                              {cycle.name}
                            </h3>
                            <p className="text-xs font-medium text-muted">{cycle.grades.length} grade{cycle.grades.length === 1 ? '' : 's'}</p>
                          </div>
                          {selectedCycleId === cycle.id && <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-1 flex-col"
              >
                <StepHeader icon={<GraduationCap className="h-5 w-5" />} title="Select Grade" body="Only Supabase grades are available." />
                <div className="grid max-h-[300px] grid-cols-2 gap-3 overflow-y-auto pr-2">
                  {(selectedCycle?.grades || []).map((grade) => (
                    <button
                      key={grade.id}
                      onClick={() => handleSelectGrade(grade)}
                      className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 text-center text-sm font-bold transition-all ${
                        selectedGradeId === grade.id
                          ? 'border-accent bg-accent text-paper shadow-sm shadow-accent/20'
                          : 'border-transparent bg-surface-low text-ink hover:border-accent/30 hover:bg-paper'
                      }`}
                    >
                      {grade.name}
                      {selectedGradeId === grade.id && <CheckCircle2 className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {requiresBacTrack && step === 3 && (
              <motion.div
                key="step-track"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-1 flex-col"
              >
                <StepHeader icon={<Layers className="h-5 w-5" />} title="Select Track" body="Bac lessons depend on your exact branch or track." />
                {isLoadingTracks ? (
                  <LoadingState label="Loading tracks..." />
                ) : visibleBacTracks.length === 0 ? (
                  <EmptyState message="No tracks are configured for this curriculum yet." />
                ) : (
                  <div className="grid max-h-[300px] grid-cols-1 gap-3 overflow-y-auto pr-2">
                    {visibleBacTracks.map((track) => (
                      <button
                        key={track.id}
                        onClick={() => handleSelectTrack(track.id)}
                        className={`flex items-center justify-between rounded-xl border-2 p-3 text-left text-sm font-bold transition-all ${
                          selectedBacTrackId === track.id
                            ? 'border-accent bg-accent/10 text-accent shadow-md'
                            : 'border-transparent bg-surface-low text-ink hover:border-accent/30 hover:bg-paper'
                        }`}
                      >
                        <span>{track.name}</span>
                        {selectedBacTrackId === track.id && <CheckCircle2 className="h-5 w-5" />}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {requiresInstructionOption && step === instructionOptionStep && (
              <motion.div
                key="step-instruction-option"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-1 flex-col"
              >
                <StepHeader icon={<BookA className="h-5 w-5" />} title="Instruction Option" body="Choose the configured language or international option." />
                {isLoadingInstructionOptions ? (
                  <LoadingState label="Loading instruction options..." />
                ) : (
                  <div className="grid max-h-[300px] grid-cols-1 gap-3 overflow-y-auto pr-2">
                    {instructionOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setSelectedInstructionOptionId(option.id)}
                        className={`flex items-center justify-between rounded-xl border-2 p-3 text-left text-sm font-bold transition-all ${
                          selectedInstructionOptionId === option.id
                            ? 'border-accent bg-accent/10 text-accent shadow-md'
                            : 'border-transparent bg-surface-low text-ink hover:border-accent/30 hover:bg-paper'
                        }`}
                      >
                        <span>{option.name}</span>
                        {selectedInstructionOptionId === option.id && <CheckCircle2 className="h-5 w-5" />}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {step === subjectStep && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-1 flex-col"
              >
                <StepHeader icon={<BookA className="h-5 w-5" />} title="Select Subject" body={requiresBacTrack ? 'Subjects are scoped through track_subjects.' : 'Subjects are loaded through grade_subjects.'} />
                {isLoadingSubjects ? (
                  <LoadingState label="Loading subjects..." />
                ) : subjects.length === 0 ? (
                  <EmptyState message="No subjects configured for this grade yet." />
                ) : (
                  <div className="grid max-h-[300px] grid-cols-1 gap-3 overflow-y-auto pr-2">
                    {subjects.map((subject) => (
                      <button
                        key={subject.id}
                        onClick={() => setSelectedSubjectId(subject.id)}
                        className={`flex items-center justify-between rounded-xl border-2 p-3 text-left text-sm font-bold transition-all ${
                          selectedSubjectId === subject.id
                            ? 'border-accent bg-accent/10 text-accent shadow-md'
                            : 'border-transparent bg-surface-low text-ink hover:border-accent/30 hover:bg-paper'
                        }`}
                      >
                        <span>{subject.name}</span>
                        {selectedSubjectId === subject.id && <CheckCircle2 className="h-5 w-5" />}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {step === totalSteps && (
              <motion.div
                key="step-final"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-1 flex-col items-center justify-center space-y-10 text-center"
              >
                <div className="relative">
                  <div className="absolute -inset-6 rounded-full bg-emerald-500/20 blur-3xl" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/20 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-600 shadow-md">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold tracking-tight text-ink sm:text-3xl">Workspace Ready</h2>
                  <p className="text-base font-medium text-muted">Your academic profile is configured from Supabase.</p>
                </div>
                <div className="w-full space-y-4 rounded-2xl border border-ink/5 bg-surface-low p-5 text-left text-sm">
                  <SummaryRow label="Cycle" value={selectedGrade?.cycle?.name || selectedCycle?.name || ''} />
                  <SummaryRow label="Grade" value={selectedGrade?.name || ''} />
                  {requiresBacTrack && <SummaryRow label="Track" value={selectedBacTrack?.name || ''} />}
                  {requiresInstructionOption && <SummaryRow label="Instruction" value={selectedInstructionOption?.name || ''} />}
                  <SummaryRow label="Subject" value={selectedSubject?.name || ''} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {errorMessage && (
            <div className="relative z-10 mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="relative z-10 mt-8 flex w-full items-center justify-between border-t border-ink/10 pt-6">
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={handleBack}
                  className="group flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-muted transition-all hover:bg-ink/5 hover:text-ink"
                >
                  <ArrowRight className="h-4 w-4 rotate-180 transition-transform group-hover:-translate-x-1" />
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={handleSkip}
                disabled={isSaving}
                className="rounded-xl border border-ink/10 bg-paper px-4 py-2 text-sm font-semibold text-muted shadow-sm transition-all hover:bg-surface-low hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                Skip for now
              </button>
            </div>

            {step < totalSteps ? (
              <button
                onClick={handleNext}
                disabled={!canContinue || (step === 1 && isLoadingGrades) || (requiresBacTrack && step === 3 && isLoadingTracks) || (requiresInstructionOption && step === instructionOptionStep && isLoadingInstructionOptions) || (step === subjectStep && (isLoadingSubjects || subjects.length === 0))}
                className="flex items-center gap-2 rounded-xl bg-ink px-5 py-2 text-sm font-semibold text-paper shadow-md transition-all hover:-translate-y-0.5 hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={isSaving}
                className="group flex items-center gap-2 rounded-2xl bg-accent px-6 py-2.5 text-sm font-bold text-paper shadow-md shadow-accent/20 transition-all hover:-translate-y-1 hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Enter Platform
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const StepHeader = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
  <div className="mb-8 flex items-center gap-4">
    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/10 bg-gradient-to-b from-accent/10 to-transparent text-accent shadow-sm">
      {icon}
    </div>
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      <p className="text-muted">{body}</p>
    </div>
  </div>
);

const LoadingState = ({ label }: { label: string }) => (
  <div className="flex flex-1 items-center justify-center gap-3 rounded-2xl border border-ink/5 bg-surface-low p-8 text-sm font-medium text-muted">
    <Loader2 className="h-4 w-4 animate-spin" />
    {label}
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-1 items-center justify-center rounded-2xl border border-ink/5 bg-surface-low p-8 text-center text-sm font-medium text-muted">
    {message}
  </div>
);

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4 border-b border-ink/5 pb-3 last:border-b-0 last:pb-0">
    <span className="text-sm font-bold uppercase tracking-normal text-muted">{label}</span>
    <span className="max-w-[240px] truncate text-right font-bold text-ink">{value}</span>
  </div>
);
