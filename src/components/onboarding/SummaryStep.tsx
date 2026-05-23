import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { CYCLES } from './constants';

interface SummaryStepProps {
  selectedCycle: string;
  selectedGrade: string;
  selectedTrack: string;
  selectedOption: string;
  requiresTrack: boolean;
}

export const SummaryStep: React.FC<SummaryStepProps> = ({
  selectedCycle,
  selectedGrade,
  selectedTrack,
  selectedOption,
  requiresTrack
}) => {
  return (
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
          Workspace Ready
        </h2>
        <p className="text-muted font-medium text-base">Your academic profile is perfectly configured.</p>
      </div>

      <div className="w-full bg-surface-low border border-ink/5 rounded-2xl p-5 text-left text-sm space-y-4">
        <div className="flex justify-between border-b border-ink/5 pb-3">
          <span className="text-muted font-bold uppercase text-sm tracking-wider">Cycle</span>
          <span className="font-bold text-ink">{CYCLES.find(c => c.id === selectedCycle)?.name}</span>
        </div>
        <div className="flex justify-between border-b border-ink/5 pb-3">
          <span className="text-muted font-bold uppercase text-sm tracking-wider">Grade</span>
          <span className="font-bold text-ink">{selectedGrade}</span>
        </div>
        {requiresTrack && selectedTrack && (
          <div className="flex justify-between border-b border-ink/5 pb-3">
            <span className="text-muted font-bold uppercase text-sm tracking-wider">Track</span>
            <span className="font-bold text-ink text-right max-w-[200px] truncate">{selectedTrack}</span>
          </div>
        )}
        {selectedOption && (
          <div className="flex justify-between">
            <span className="text-muted font-bold uppercase text-sm tracking-wider">Option</span>
            <span className="font-bold text-ink truncate max-w-[200px]">{selectedOption === 'biof_fr' ? 'Français' : (selectedOption === 'general_ar' ? 'Arabe' : 'Anglais')}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
