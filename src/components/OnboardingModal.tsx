import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, GraduationCap, BookOpen, Globe, Search } from 'lucide-react';
import { supabase } from '../db/supabase';
import { useAuth } from '../context/AuthContext';
import { db } from '../db/db';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [selectedCycle, setSelectedCycle] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [selectedLanguageOption, setSelectedLanguageOption] = useState<string | null>(null);

  if (!isOpen) return null;

  // Constants
  const CYCLES = [
    { id: 'primary', name: 'Primary Education', desc: 'Enseignement Primaire' },
    { id: 'college', name: 'Middle School', desc: 'Collège' },
    { id: 'lycee', name: 'High School', desc: 'Lycée' },
  ];

  const GRADES_MAP: Record<string, string[]> = {
    primary: [
      '1ère année primaire', '2ème année primaire', '3ème année primaire',
      '4ème année primaire', '5ème année primaire', '6ème année primaire'
    ],
    college: [
      '1ère année collège', '2ème année collège', '3ème année collège'
    ],
    lycee: [
      'Tronc Commun', '1ère année Bac', '2ème année Bac'
    ]
  };

  const TRACKS_MAP: Record<string, string[]> = {
    'Tronc Commun': ['Tronc Commun Scientifique', 'Tronc Commun Littéraire', 'Tronc Commun Technologique'],
    '1ère année Bac': ['Sciences Mathématiques', 'Sciences Expérimentales', 'Sciences et Technologies', 'Lettres et Sciences Humaines', 'Sciences Économiques et Gestion'],
    '2ème année Bac': ['Sciences Mathématiques A', 'Sciences Mathématiques B', 'Sciences Physiques', 'SVT', 'Sciences Agronomiques', 'Lettres', 'Sciences Humaines', 'Sciences Économiques', 'Techniques de Gestion Comptable']
  };

  const LANGUAGE_OPTIONS = [
    { id: 'general_ar', name: 'Général (Arabe)', desc: 'Subjects taught in Arabic' },
    { id: 'biof_fr', name: 'Option Français (BIOF)', desc: 'Math, Physics, and SVT taught in French' },
    { id: 'biof_en', name: 'Option Anglais (BIOF)', desc: 'Starting slowly in some regions' }
  ];

  const isLycee = selectedCycle === 'lycee';
  const totalSteps = isLycee ? 5 : 3;

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      if (user) {
        // Build update object based on what was selected
        const updates = {
          onboarding_completed: true,
          selected_cycle: selectedCycle,
          selected_grade: selectedGrade,
          selected_bac_track: isLycee ? selectedTrack : null,
          selected_language_option: isLycee ? selectedLanguageOption : null,
        };

        const { error: dbError } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id);

        if (dbError) throw dbError;
      }

      // Update Local State for fast access
      localStorage.setItem('has_completed_onboarding', 'true');
      if (selectedGrade) localStorage.setItem('selected_grade', selectedGrade);
      if (selectedTrack) localStorage.setItem('selected_bac_track', selectedTrack);

      await db.settings.put({ key: 'has_completed_onboarding', value: 'true' });

      onComplete();
    } catch (err: any) {
      console.error('Failed to save onboarding state:', err);
      setError(err.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-paper w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col relative max-h-[90vh]"
      >
        <div className="p-8 flex-1 overflow-y-auto">
          {/* Progress Indicator */}
          <div className="flex gap-2 mb-8">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-all ${
                  i < step ? 'bg-accent' : 'bg-surface-mid'
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-500/10 text-red-500 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* Step 1: Cycle */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-ink mb-2">Welcome to LevelSpace</h2>
                  <p className="text-muted">Let's set up your profile. What is your current educational cycle?</p>
                </div>
                <div className="grid gap-4">
                  {CYCLES.map(cycle => (
                    <button
                      key={cycle.id}
                      onClick={() => {
                        setSelectedCycle(cycle.id);
                        setSelectedGrade(null);
                        setSelectedTrack(null);
                        setSelectedLanguageOption(null);
                      }}
                      className={`p-4 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${
                        selectedCycle === cycle.id
                          ? 'border-accent bg-accent/5'
                          : 'border-surface-mid hover:border-accent/50 bg-background'
                      }`}
                    >
                      <div>
                        <div className={`font-bold text-lg ${selectedCycle === cycle.id ? 'text-accent' : 'text-ink'}`}>
                          {cycle.name}
                        </div>
                        <div className="text-sm text-muted">{cycle.desc}</div>
                      </div>
                      {selectedCycle === cycle.id && <CheckCircle2 className="text-accent" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 2: Grade */}
            {step === 2 && selectedCycle && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-ink mb-2">Select your Grade</h2>
                  <p className="text-muted">Which year are you currently in?</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {GRADES_MAP[selectedCycle].map(grade => (
                    <button
                      key={grade}
                      onClick={() => {
                        setSelectedGrade(grade);
                        setSelectedTrack(null);
                      }}
                      className={`p-4 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${
                        selectedGrade === grade
                          ? 'border-accent bg-accent/5 text-accent font-bold'
                          : 'border-surface-mid hover:border-accent/50 bg-background text-ink'
                      }`}
                    >
                      <span>{grade}</span>
                      {selectedGrade === grade && <CheckCircle2 className="w-5 h-5 text-accent" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 3: Track (Lycée Only) */}
            {step === 3 && isLycee && selectedGrade && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-ink mb-2">Select your Track</h2>
                  <p className="text-muted">What is your specialty or branch?</p>
                </div>
                <div className="grid gap-3">
                  {TRACKS_MAP[selectedGrade]?.map(track => (
                    <button
                      key={track}
                      onClick={() => setSelectedTrack(track)}
                      className={`p-4 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${
                        selectedTrack === track
                          ? 'border-accent bg-accent/5 text-accent font-bold'
                          : 'border-surface-mid hover:border-accent/50 bg-background text-ink'
                      }`}
                    >
                      <span>{track}</span>
                      {selectedTrack === track && <CheckCircle2 className="w-5 h-5 text-accent" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 4: Language Option (Lycée Only) */}
            {step === 4 && isLycee && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-ink mb-2">Language Option</h2>
                  <p className="text-muted">In which language do you study scientific subjects?</p>
                </div>
                <div className="grid gap-4">
                  {LANGUAGE_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedLanguageOption(opt.id)}
                      className={`p-4 rounded-2xl border-2 text-left flex flex-col gap-1 transition-all ${
                        selectedLanguageOption === opt.id
                          ? 'border-accent bg-accent/5'
                          : 'border-surface-mid hover:border-accent/50 bg-background'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className={`font-bold ${selectedLanguageOption === opt.id ? 'text-accent' : 'text-ink'}`}>
                          {opt.name}
                        </span>
                        {selectedLanguageOption === opt.id && <CheckCircle2 className="w-5 h-5 text-accent" />}
                      </div>
                      <span className="text-sm text-muted">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Summary Step */}
            {step === totalSteps && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8 flex flex-col items-center py-8"
              >
                <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-10 h-10 text-accent" />
                </div>
                <h2 className="text-3xl font-bold text-ink text-center">You're all set!</h2>

                <div className="w-full bg-background border border-surface-mid rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between border-b border-surface-mid pb-3">
                    <span className="text-muted">Cycle</span>
                    <span className="font-bold text-ink">{CYCLES.find(c => c.id === selectedCycle)?.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-surface-mid pb-3">
                    <span className="text-muted">Grade</span>
                    <span className="font-bold text-ink">{selectedGrade}</span>
                  </div>
                  {isLycee && (
                    <>
                      <div className="flex justify-between border-b border-surface-mid pb-3">
                        <span className="text-muted">Track</span>
                        <span className="font-bold text-ink">{selectedTrack}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Language</span>
                        <span className="font-bold text-ink">
                          {LANGUAGE_OPTIONS.find(l => l.id === selectedLanguageOption)?.name}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        <div className="p-6 bg-background border-t border-surface-mid flex justify-between items-center">
          {step > 1 ? (
            <button
              onClick={handleBack}
              disabled={isSubmitting}
              className="px-6 py-3 font-semibold text-muted hover:text-ink transition-colors disabled:opacity-50"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < totalSteps ? (
            <button
              onClick={handleNext}
              disabled={
                (step === 1 && !selectedCycle) ||
                (step === 2 && !selectedGrade) ||
                (step === 3 && !selectedTrack) ||
                (step === 4 && !selectedLanguageOption)
              }
              className="flex items-center gap-2 px-8 py-3 bg-accent text-paper font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-8 py-3 bg-accent text-paper font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Enter Platform'}
              {!isSubmitting && <ArrowRight className="w-4 h-4" />}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
