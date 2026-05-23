import React from 'react';
import { motion } from 'motion/react';
import { Globe, CheckCircle2 } from 'lucide-react';

interface LanguageOptionStepProps {
  selectedOption: string;
  onSelectOption: (option: string) => void;
}

export const LanguageOptionStep: React.FC<LanguageOptionStepProps> = ({ selectedOption, onSelectOption }) => {
  return (
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
        {[
          { id: 'biof_fr', name: 'Option Français (BIOF)', desc: 'Math, Physics, and SVT are taught in French' },
          { id: 'general_ar', name: 'Option Arabe (Général)', desc: 'Scientific subjects taught in Arabic' },
          { id: 'biof_en', name: 'Option Anglais (BIOF)', desc: 'Starting slowly in some regions' }
        ].map(opt => (
          <button
            key={opt.id}
            onClick={() => onSelectOption(opt.id)}
            className={`p-4 rounded-xl border-2 text-sm transition-all text-left flex items-start justify-between group ${
              selectedOption === opt.id
                ? 'bg-accent/5 border-accent shadow-md'
                : 'bg-surface-low border-transparent hover:border-accent/30 hover:bg-paper'
            }`}
          >
            <div>
              <h3 className={`font-bold text-base mb-1 ${selectedOption === opt.id ? 'text-accent' : 'text-ink'}`}>{opt.name}</h3>
              <p className="text-xs text-muted">{opt.desc}</p>
            </div>
            {selectedOption === opt.id && <CheckCircle2 className="w-5 h-5 text-accent mt-2" />}
          </button>
        ))}
      </div>
    </motion.div>
  );
};
