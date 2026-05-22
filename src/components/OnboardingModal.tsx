import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  BookA,
  BrainCircuit,
  CheckCircle2,
  GraduationCap,
  Layers,
  LibraryBig,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../db/supabase';
import { db } from '../db/db';
import {
  CurriculumGrade,
  CurriculumSubject,
  debugVerifyOnboardingCurriculum,
  getGrades,
  getSubjectsForGrade,
  validateGradeSubjectPair,
} from '../services/curriculumService';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

const cycleIcon = (cycleName: string) => {
  const normalized = cycleName.toLowerCase();
  if (normalized.includes('primaire') || normalized.includes('primary')) return BookA;
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

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  const { profile, user } = useAuth();

  const [step, setStep] = useState(0);
  const [grades, setGrades] = useState<CurriculumGrade[]>([]);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [isLoadingGrades, setIsLoadingGrades] = useState(false);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const userName = profile?.full_name || (user?.email ? user.email.split('@')[0] : 'Explorer');
  const totalSteps = 4;
  const cycleGroups = useMemo(() => groupGradesByCycle(grades), [grades]);
  const selectedCycle = cycleGroups.find((cycle) => cycle.id === selectedCycleId) || null;
  const selectedGrade = grades.find((grade) => grade.id === selectedGradeId) || null;
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) || null;

  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen]);

  useEffect(() => {
    if (!selectedGradeId) {
      setSubjects([]);
      setSelectedSubjectId('');
      return;
    }

    const grade = grades.find((row) => row.id === selectedGradeId);
    let cancelled = false;
    setIsLoadingSubjects(true);
    setErrorMessage('');
    setSelectedSubjectId('');

    getSubjectsForGrade(selectedGradeId)
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
  }, [grades, selectedGradeId]);

  const handleSelectCycle = (cycleId: string) => {
    setSelectedCycleId(cycleId);
    setSelectedGradeId('');
    setSelectedSubjectId('');
    setSubjects([]);
    setErrorMessage('');
  };

  const handleSelectGrade = (grade: CurriculumGrade) => {
    setSelectedGradeId(grade.id);
    setSelectedSubjectId('');
    setSubjects([]);
    setErrorMessage('');
  };

  const handleNext = () => setStep((current) => Math.min(current + 1, totalSteps));
  const handleBack = () => setStep((current) => Math.max(current - 1, 0));

  const persistSetting = async (key: string, value: string) => {
    localStorage.setItem(key, value);
    await db.settings.put({ key, value });
  };

  const handleComplete = async () => {
    if (!selectedGrade || !selectedSubject) {
      setErrorMessage('Select a valid grade and subject before continuing.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const isValidPair = await validateGradeSubjectPair(selectedGrade.id, selectedSubject.id);
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

      localStorage.removeItem('selected_bac_track');
      localStorage.removeItem('selected_option');
      await db.settings.delete('selected_bac_track');
      await db.settings.delete('selected_option');

      if (user) {
        try {
          await updateProfile(user.id, {
            onboarding_completed: true,
            selected_grade_id: selectedGrade.id,
            selected_grade: selectedGrade.name,
            selected_subject_id: selectedSubject.id,
            selected_subject: selectedSubject.name,
            selected_bac_track: null,
          });
        } catch (error: any) {
          console.error('Failed to persist onboarding to database:', error.message);
        }
      }

      onComplete();
    } catch (error) {
      console.error('[onboarding] Failed to save curriculum selection:', error);
      setErrorMessage('Unable to save onboarding selection.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const canContinue =
    (step === 0) ||
    (step === 1 && Boolean(selectedCycleId)) ||
    (step === 2 && Boolean(selectedGradeId)) ||
    (step === 3 && Boolean(selectedSubjectId));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/40 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-ink/10 bg-paper shadow-md"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent" />

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
                  <EmptyState message="No grades configured yet." />
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

            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-1 flex-col"
              >
                <StepHeader icon={<BookA className="h-5 w-5" />} title="Select Subject" body="Subjects are loaded through grade_subjects." />
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
            {step > 0 ? (
              <button
                onClick={handleBack}
                className="group flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold text-muted transition-all hover:bg-ink/5 hover:text-ink"
              >
                <ArrowRight className="h-4 w-4 rotate-180 transition-transform group-hover:-translate-x-1" />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < totalSteps ? (
              <button
                onClick={handleNext}
                disabled={!canContinue || (step === 1 && isLoadingGrades) || (step === 3 && (isLoadingSubjects || subjects.length === 0))}
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
