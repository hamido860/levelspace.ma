import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../db/supabase';
import { db } from '../db/db';

import {
  WelcomeStep,
  CycleStep,
  GradeStep,
  TrackStep,
  LanguageOptionStep,
  SummaryStep
} from './onboarding';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  const { profile, user } = useAuth();
  
  const [step, setStep] = useState(0);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [selectedOption, setSelectedOption] = useState('');

  const userName = profile?.full_name || (user?.email ? user.email.split('@')[0] : 'Explorer');

  const requiresTrack = selectedCycle === 'lycee';
  const totalSteps = requiresTrack ? 5 : 4; // 0=Welcome, 1=Cycle, 2=Grade, 3=Track(if lycee), 4/option=Done 

  const handleNext = () => setStep(s => Math.min(s + 1, totalSteps));
  const handleBack = () => setStep(s => Math.max(s - 1, 0));

  const handleComplete = async () => {
    localStorage.setItem('selected_country', 'Morocco');
    localStorage.setItem('selected_cycle', selectedCycle);
    localStorage.setItem('selected_grade', selectedGrade);
    if (selectedTrack) localStorage.setItem('selected_bac_track', selectedTrack);
    if (selectedOption) localStorage.setItem('selected_option', selectedOption);
    localStorage.setItem('has_completed_onboarding', 'true');

    await db.settings.put({ key: 'selected_country', value: 'Morocco' });
    await db.settings.put({ key: 'selected_cycle', value: selectedCycle });
    await db.settings.put({ key: 'selected_grade', value: selectedGrade });
    if (selectedTrack) await db.settings.put({ key: 'selected_bac_track', value: selectedTrack });
    if (selectedOption) await db.settings.put({ key: 'selected_option', value: selectedOption });
    await db.settings.put({ key: 'has_completed_onboarding', value: 'true' });

    // Persist academic profile to Supabase for backend enforcement
    if (user) {
      try {
        await updateProfile(user.id, {
          onboarding_completed: true,
          selected_grade: selectedGrade,
          selected_bac_track: selectedTrack || null,
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
            
            {step === 0 && <WelcomeStep key="step-0" userName={userName} />}

            {step === 1 && (
              <CycleStep
                key="step-1"
                selectedCycle={selectedCycle}
                onSelectCycle={(cycleId) => {
                  setSelectedCycle(cycleId);
                  setSelectedGrade('');
                  setSelectedTrack('');
                }}
              />
            )}

            {step === 2 && (
              <GradeStep
                key="step-2"
                selectedCycle={selectedCycle}
                selectedGrade={selectedGrade}
                onSelectGrade={(grade) => {
                  setSelectedGrade(grade);
                  setSelectedTrack('');
                }}
              />
            )}

            {step === 3 && requiresTrack && (
              <TrackStep
                key="step-3"
                selectedGrade={selectedGrade}
                selectedTrack={selectedTrack}
                onSelectTrack={setSelectedTrack}
              />
            )}

            {step === (requiresTrack ? 4 : 3) && (
              <LanguageOptionStep
                key="step-option"
                selectedOption={selectedOption}
                onSelectOption={setSelectedOption}
              />
            )}

            {step === totalSteps && (
              <SummaryStep
                key="step-final"
                selectedCycle={selectedCycle}
                selectedGrade={selectedGrade}
                selectedTrack={selectedTrack}
                selectedOption={selectedOption}
                requiresTrack={requiresTrack}
              />
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
                  (step === 1 && !selectedCycle) || 
                  (step === 2 && !selectedGrade) || 
                  (step === 3 && requiresTrack && !selectedTrack) ||
                  (step === (requiresTrack ? 4 : 3) && !selectedOption)
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
