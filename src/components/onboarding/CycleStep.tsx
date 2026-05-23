import React from 'react';
import { motion } from 'motion/react';
import { Layers, CheckCircle2 } from 'lucide-react';
import { CYCLES } from './constants';

interface CycleStepProps {
  selectedCycle: string;
  onSelectCycle: (cycleId: string) => void;
}

export const CycleStep: React.FC<CycleStepProps> = ({ selectedCycle, onSelectCycle }) => {
  return (
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
          <h2 className="text-lg font-display font-semibold text-ink tracking-tight">Academic Phase</h2>
          <p className="text-muted">Select your current educational cycle.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CYCLES.map(cycle => (
          <button
            key={cycle.id}
            onClick={() => onSelectCycle(cycle.id)}
            className={`p-5 rounded-[1.5rem] border-2 transition-all text-left flex items-start gap-4 group ${
              selectedCycle === cycle.id
                ? 'bg-accent/5 border-accent shadow-sm shadow-accent/10 scale-[1.02]'
                : 'bg-surface-low border-transparent hover:border-accent/30 hover:bg-paper hover:shadow-md'
            }`}
          >
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
              selectedCycle === cycle.id ? 'bg-accent text-paper' : 'bg-surface-mid text-ink-secondary group-hover:bg-accent/10 group-hover:text-accent'
            }`}>
              <cycle.icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className={`font-bold text-base leading-tight mb-1 ${selectedCycle === cycle.id ? 'text-accent' : 'text-ink'}`}>
                {cycle.name}
              </h3>
              <p className="text-xs text-muted font-medium">{cycle.desc}</p>
            </div>
            {selectedCycle === cycle.id && <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />}
          </button>
        ))}
      </div>
    </motion.div>
  );
};
