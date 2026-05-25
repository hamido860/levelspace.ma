import React from 'react';
import { motion } from 'motion/react';
import { GraduationCap, CheckCircle2 } from 'lucide-react';
import { GRADES_MAP } from './constants';

interface GradeStepProps {
  selectedCycle: string;
  selectedGrade: string;
  onSelectGrade: (grade: string) => void;
}

export const GradeStep: React.FC<GradeStepProps> = ({ selectedCycle, selectedGrade, onSelectGrade }) => {
  return (
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
        {GRADES_MAP[selectedCycle]?.map(grade => (
          <button
            key={grade}
            onClick={() => onSelectGrade(grade)}
            className={`p-3 rounded-xl border-2 text-sm font-bold transition-all text-center flex items-center justify-center gap-2 ${
              selectedGrade === grade
                ? 'bg-accent border-accent text-paper shadow-sm shadow-accent/20'
                : 'bg-surface-low border-transparent text-ink hover:border-accent/30 hover:bg-paper'
            }`}
          >
            {grade}
            {selectedGrade === grade && <CheckCircle2 className="w-4 h-4" />}
          </button>
        ))}
      </div>
    </motion.div>
  );
};
