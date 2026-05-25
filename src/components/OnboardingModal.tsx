import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GraduationCap, ArrowRight, CheckCircle2, Sparkles, BookOpen, Layers,
  BookA, BrainCircuit, LibraryBig, Globe, BookMarked
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateProfile, supabase } from '../db/supabase';
import { db } from '../db/db';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

const CYCLE_ICONS: Record<string, any> = {
  'التعليم الإبتدائي (Enseignement Primaire)': BookA,
  'التعليم الثانوي الإعدادي (Collège)': LibraryBig,
  'التعليم الثانوي التأهيلي (Lycée)': GraduationCap,
};

function getCycleIcon(cycleName: string) {
  for (const [key, icon] of Object.entries(CYCLE_ICONS)) {
    if (cycleName.includes(key) || key.includes(cycleName)) return icon;
  }
  return BrainCircuit;
}

function shouldShowTrackSelector(cycleName: string, gradeName: string) {
  return cycleName.toLowerCase().includes('lycée') || gradeName.toLowerCase().includes('bac') || gradeName.toLowerCase().includes('tronc commun');
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  const { profile, user } = useAuth();
  
  const [step, setStep] = useState(0);
  
  // Data from Supabase
  const [cycles, setCycles] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [options, setOptions] = useState<any[]>([]);

  // Selected State (IDs)
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [selectedOptionId, setSelectedOptionId] = useState('');

  // Selected Entities for display
  const selectedCycle = cycles.find(c => c.id === selectedCycleId);
  const selectedGrade = grades.find(g => g.id === selectedGradeId);
  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);
  const selectedTrack = tracks.find(t => t.id === selectedTrackId);
  const selectedOption = options.find(o => o.id === selectedOptionId);

  const [loading, setLoading] = useState(false);

  const userName = profile?.full_name || (user?.email ? user.email.split('@')[0] : 'Explorer');

  const requiresTrack = selectedCycle && selectedGrade && shouldShowTrackSelector(selectedCycle.name, selectedGrade.name);
  // 0=Welcome, 1=Cycle, 2=Grade, 3=Subject, 4=Track(if lycee), 5=Option(if lycee), 6=Done
  let totalSteps = 4; // Welcome, Cycle, Grade, Subject, Done
  if (requiresTrack) {
    totalSteps = 6;
  }

  // Fetch initial cycles and options
  useEffect(() => {
    if (isOpen) {
      supabase.from('cycles').select('*').order('cycle_order').then(({ data }) => setCycles(data || []));
      supabase.from('bac_tracks').select('*').order('track_order').then(({ data }) => setTracks(data || []));
      supabase.from('bac_international_options').select('*').then(({ data }) => setOptions(data || []));
    }
  }, [isOpen]);

  // Fetch grades when cycle changes
  useEffect(() => {
    if (selectedCycleId) {
      supabase.from('grades').select('*').eq('cycle_id', selectedCycleId).order('grade_order')
        .then(({ data }) => setGrades(data || []));
    } else {
      setGrades([]);
    }
  }, [selectedCycleId]);

  // Fetch subjects when grade changes
  useEffect(() => {
    if (selectedGradeId) {
      const getSubjectsForGrade = async (gradeId: string) => {
        setLoading(true);
        const { data } = await supabase
          .from('grade_subjects')
          .select('subjects(id, name, code)')
          .eq('grade_id', gradeId);
        
        const mappedSubjects = data?.map((d: any) => d.subjects).filter(Boolean) || [];
        setSubjects(mappedSubjects);
        setLoading(false);
      };
      getSubjectsForGrade(selectedGradeId);
    } else {
      setSubjects([]);
    }
  }, [selectedGradeId]);

  const handleNext = () => setStep(s => Math.min(s + 1, totalSteps));
  const handleBack = () => setStep(s => Math.max(s - 1, 0));

  const handleCycleChange = (id: string) => {
    setSelectedCycleId(id);
    setSelectedGradeId("");
    setSelectedSubjectId("");
    setSelectedTrackId("");
    setSelectedOptionId("");
  };

  const handleGradeChange = (id: string) => {
    setSelectedGradeId(id);
    setSelectedSubjectId("");
    setSelectedTrackId("");
    setSelectedOptionId("");
    
    // Debug logging as requested
    const grade = grades.find(g => g.id === id);
    console.debug("[onboarding] selected grade", grade);
    if (grade && selectedCycle) {
      console.debug("[onboarding] track selector visible", shouldShowTrackSelector(selectedCycle.name, grade.name));
    }
    console.debug("[onboarding] cleared invalid track fields", { track_id: null, option_id: null, subject_id: null });
  };

  useEffect(() => {
    if (subjects.length > 0) {
      console.debug("[onboarding] grade subjects", subjects);
    }
  }, [subjects]);

  const handleComplete = async () => {
    // Save validation
    if (!selectedGradeId) {
      console.error("Save rejected: grade_id missing");
      return;
    }
    if (selectedSubjectId && !subjects.find(s => s.id === selectedSubjectId)) {
      console.error("Save rejected: subject_id doesn't belong to grade_id");
      return;
    }
    if (selectedTrackId || selectedOptionId) {
      if (!requiresTrack) {
        console.error("Save rejected: track/option selected for primary/college");
        return;
      }
    }

    localStorage.setItem('selected_country', 'Morocco');
    localStorage.setItem('selected_cycle', selectedCycle?.name || '');
    localStorage.setItem('selected_grade', selectedGrade?.name || '');
    if (selectedTrack) localStorage.setItem('selected_bac_track', selectedTrack.id);
    if (selectedOption) localStorage.setItem('selected_option', selectedOption.id);
    localStorage.setItem('has_completed_onboarding', 'true');

    await db.settings.put({ key: 'selected_country', value: 'Morocco' });
    await db.settings.put({ key: 'selected_cycle', value: selectedCycle?.name || '' });
    await db.settings.put({ key: 'selected_grade', value: selectedGrade?.name || '' });
    if (selectedTrack) await db.settings.put({ key: 'selected_bac_track', value: selectedTrack.id });
    if (selectedOption) await db.settings.put({ key: 'selected_option', value: selectedOption.id });
    await db.settings.put({ key: 'has_completed_onboarding', value: 'true' });

    if (user) {
      try {
        await updateProfile(user.id, {
          onboarding_completed: true,
          selected_grade: selectedGrade?.name || '',
          selected_bac_track: selectedTrackId || null,
        });
      } catch (err: any) {
        console.error('Failed to persist onboarding to database:', err.message);
      }
    }

    onComplete();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/40 ">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-paper w-full max-w-xl rounded-[2rem] shadow-md overflow-hidden border border-ink/10 relative"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="absolute top-0 left-0 w-full h-1 bg-ink/5">
          <motion.div 
            className="h-full bg-accent"
            initial={{ width: '0%' }}
            animate={{ width: `${(step / totalSteps) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="p-6 md:p-10 min-h-[425px] flex flex-col">
          <AnimatePresence mode="wait">
            
            {/* STEP 0: WELCOME */}
            {step === 0 && (
              <motion.div
                key="step-0"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
              >
                <div className="relative">
                  <div className="absolute -inset-4 bg-accent/20 blur-2xl rounded-full animate-pulse" />
                  <div className="relative w-20 h-20 bg-accent rounded-3xl flex items-center justify-center text-paper shadow-md rotate-3">
                    <Sparkles className="w-8 h-8" />
                  </div>
                </div>
                <div className="space-y-4">
                  <h1 className="text-xl sm:text-3xl font-display font-bold text-ink leading-[1.1] tracking-tight">
                    Welcome to Levelspace.<br />
                    <span className="text-accent capitalize">{userName}</span>
                  </h1>
                  <p className="text-muted text-sm max-w-sm mx-auto font-medium leading-relaxed">
                    Before we start, let's find your level.
                  </p>
                </div>
              </motion.div>
            )}

            {/* STEP 1: CYCLE */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 bg-gradient-to-b from-accent/10 to-transparent border border-accent/10 rounded-xl flex items-center justify-center text-accent shadow-sm">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-semibold text-ink tracking-tight">FirstStep</h2>
                    <p className="text-muted text-sm">Answer a few simple questions. This helps us choose the best path for you.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                  {cycles.map(cycle => {
                    const Icon = getCycleIcon(cycle.name);
                    return (
                      <button
                        key={cycle.id}
                        onClick={() => handleCycleChange(cycle.id)}
                        className={`p-5 rounded-[1.5rem] border-2 transition-all text-left flex items-start gap-4 group ${
                          selectedCycleId === cycle.id 
                            ? 'bg-accent/5 border-accent shadow-sm shadow-accent/10 scale-[1.02]' 
                            : 'bg-surface-low border-transparent hover:border-accent/30 hover:bg-paper hover:shadow-md'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                          selectedCycleId === cycle.id ? 'bg-accent text-paper' : 'bg-surface-mid text-ink-secondary group-hover:bg-accent/10 group-hover:text-accent'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h3 className={`font-bold text-base leading-tight mb-1 ${selectedCycleId === cycle.id ? 'text-accent' : 'text-ink'}`}>
                            {cycle.name}
                          </h3>
                        </div>
                        {selectedCycleId === cycle.id && <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 2: GRADE */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 bg-gradient-to-b from-accent/10 to-transparent border border-accent/10 rounded-xl flex items-center justify-center text-accent shadow-sm">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-semibold text-ink tracking-tight">Select Grade</h2>
                    <p className="text-muted">Which specific year are you currently in?</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                  {grades.map(grade => (
                    <button
                      key={grade.id}
                      onClick={() => handleGradeChange(grade.id)}
                      className={`p-3 rounded-xl border-2 text-sm font-bold transition-all text-center flex items-center justify-center gap-2 ${
                        selectedGradeId === grade.id 
                          ? 'bg-accent border-accent text-paper shadow-sm shadow-accent/20' 
                          : 'bg-surface-low border-transparent text-ink hover:border-accent/30 hover:bg-paper'
                      }`}
                    >
                      {grade.name}
                      {selectedGradeId === grade.id && <CheckCircle2 className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 3: SUBJECT */}
            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 bg-gradient-to-b from-accent/10 to-transparent border border-accent/10 rounded-xl flex items-center justify-center text-accent shadow-sm">
                    <BookMarked className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-semibold text-ink tracking-tight">Select Primary Subject</h2>
                    <p className="text-muted">Optional: focus on a specific subject.</p>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                  {loading ? (
                    <p className="text-sm text-muted">Loading subjects...</p>
                  ) : subjects.length === 0 ? (
                    <div className="p-4 bg-surface-low rounded-xl border border-ink/5 text-center text-muted text-sm">
                      No subjects configured for this grade yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {subjects.map(subject => (
                        <button
                          key={subject.id}
                          onClick={() => setSelectedSubjectId(subject.id)}
                          className={`p-3 rounded-xl border-2 text-sm font-bold transition-all text-left flex items-center justify-between group ${
                            selectedSubjectId === subject.id 
                              ? 'bg-accent/10 border-accent text-accent shadow-md' 
                              : 'bg-surface-low border-transparent text-ink hover:border-accent/30 hover:bg-paper'
                          }`}
                        >
                          <span className="truncate">{subject.name}</span>
                          {selectedSubjectId === subject.id && <CheckCircle2 className="w-5 h-5 shrink-0 ml-2" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 4: TRACK (For Lycée) */}
            {step === 4 && requiresTrack && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 bg-gradient-to-b from-accent/10 to-transparent border border-accent/10 rounded-xl flex items-center justify-center text-accent shadow-sm">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-semibold text-ink tracking-tight">Specialty / Track</h2>
                    <p className="text-muted">Choose your specific focus area.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                  {tracks.length === 0 ? (
                    <div className="p-4 bg-surface-low rounded-xl border border-ink/5 text-center text-muted text-sm">
                      No tracks configured.
                    </div>
                  ) : (
                    tracks.map(track => (
                      <button
                        key={track.id}
                        onClick={() => setSelectedTrackId(track.id)}
                        className={`p-3 rounded-xl border-2 text-sm font-bold transition-all text-left flex items-center justify-between group ${
                          selectedTrackId === track.id 
                            ? 'bg-accent/10 border-accent text-accent shadow-md' 
                            : 'bg-surface-low border-transparent text-ink hover:border-accent/30 hover:bg-paper'
                        }`}
                      >
                        {track.name}
                        {selectedTrackId === track.id && <CheckCircle2 className="w-5 h-5" />}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 5: INTERNATIONAL OPTION (If applicable) */}
            {step === 5 && requiresTrack && (
              <motion.div
                 key="step-option"
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 className="flex-1 flex flex-col"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 bg-gradient-to-b from-accent/10 to-transparent border border-accent/10 rounded-xl flex items-center justify-center text-accent shadow-sm">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-semibold text-ink tracking-tight">Language Option</h2>
                    <p className="text-muted">In which language do you study scientific subjects?</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {options.length === 0 ? (
                    <div className="p-4 bg-surface-low rounded-xl border border-ink/5 text-center text-muted text-sm">
                      No language options configured.
                    </div>
                  ) : (
                    options.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setSelectedOptionId(opt.id)}
                        className={`p-4 rounded-xl border-2 text-sm transition-all text-left flex items-start justify-between group ${
                          selectedOptionId === opt.id 
                            ? 'bg-accent/5 border-accent shadow-md' 
                            : 'bg-surface-low border-transparent hover:border-accent/30 hover:bg-paper'
                        }`}
                      >
                        <div>
                          <h3 className={`font-bold text-base mb-1 ${selectedOptionId === opt.id ? 'text-accent' : 'text-ink'}`}>{opt.name}</h3>
                        </div>
                        {selectedOptionId === opt.id && <CheckCircle2 className="w-5 h-5 text-accent mt-2" />}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP: DONE SUMMARY */}
            {step === totalSteps && (
               <motion.div
                 key="step-final"
                 initial={{ opacity: 0, scale: 0.95 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.95 }}
                 className="flex-1 flex flex-col items-center justify-center text-center space-y-10"
               >
                 <div className="relative">
                   <div className="absolute -inset-6 bg-emerald-500/20 blur-3xl rounded-full" />
                   <div className="relative w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 rounded-full flex items-center justify-center text-paper shadow-md">
                     <CheckCircle2 className="w-10 h-10" />
                   </div>
                 </div>

                 <div className="space-y-2">
                    <h2 className="text-xl sm:text-3xl font-display font-bold text-ink tracking-tight">
                      Your Starting Level is Ready
                    </h2>
                    <p className="text-muted font-medium text-base">We will guide you step by step.</p>
                  </div>

                 <div className="w-full bg-surface-low border border-ink/5 rounded-2xl p-5 text-left text-sm space-y-4">
                   <div className="flex justify-between border-b border-ink/5 pb-3">
                     <span className="text-muted font-bold uppercase text-sm tracking-wider">Cycle</span>
                     <span className="font-bold text-ink">{selectedCycle?.name}</span>
                   </div>
                   <div className="flex justify-between border-b border-ink/5 pb-3">
                     <span className="text-muted font-bold uppercase text-sm tracking-wider">Grade</span>
                     <span className="font-bold text-ink">{selectedGrade?.name}</span>
                   </div>
                   {selectedSubject && (
                     <div className="flex justify-between border-b border-ink/5 pb-3">
                       <span className="text-muted font-bold uppercase text-sm tracking-wider">Subject</span>
                       <span className="font-bold text-ink truncate max-w-[200px]">{selectedSubject.name}</span>
                     </div>
                   )}
                   {requiresTrack && selectedTrack && (
                     <div className="flex justify-between border-b border-ink/5 pb-3">
                       <span className="text-muted font-bold uppercase text-sm tracking-wider">Track</span>
                       <span className="font-bold text-ink text-right max-w-[200px] truncate">{selectedTrack.name}</span>
                     </div>
                   )}
                   {requiresTrack && selectedOption && (
                     <div className="flex justify-between">
                       <span className="text-muted font-bold uppercase text-sm tracking-wider">Option</span>
                       <span className="font-bold text-ink truncate max-w-[200px]">{selectedOption.name}</span>
                     </div>
                   )}
                 </div>
               </motion.div>
            )}

          </AnimatePresence>

          {/* Navigation Controls */}
          <div className="mt-8 flex items-center justify-between pt-6 border-t border-ink/10 relative z-10 w-full">
            {step > 0 ? (
              <button
                onClick={handleBack}
                className="px-5 py-2.5 text-sm rounded-2xl font-bold text-muted hover:text-ink hover:bg-ink/5 transition-all flex items-center gap-2 group"
              >
                <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < totalSteps ? (
              <button
                onClick={handleNext}
                disabled={
                  (step === 1 && !selectedCycleId) || 
                  (step === 2 && !selectedGradeId) ||
                  // Subject selection is optional, let them continue even if none selected
                  (step === 4 && requiresTrack && !selectedTrackId) ||
                  (step === 5 && requiresTrack && !selectedOptionId)
                }
                className="px-5 py-2 text-sm bg-ink text-paper rounded-xl font-semibold flex items-center gap-2 hover:bg-ink/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:-translate-y-0.5"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="px-6 py-2.5 text-sm bg-accent text-paper rounded-2xl font-bold flex items-center gap-2 hover:bg-[var(--accent-hover)] transition-all shadow-md shadow-accent/20 hover:-translate-y-1 group"
              >
                Enter Platform
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
