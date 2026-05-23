import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, CheckCircle2 } from 'lucide-react';
import { TRACKS_MAP } from './constants';

interface TrackStepProps {
  selectedGrade: string;
  selectedTrack: string;
  onSelectTrack: (track: string) => void;
}

export const TrackStep: React.FC<TrackStepProps> = ({ selectedGrade, selectedTrack, onSelectTrack }) => {
  return (
    <motion.div
      key="step-3"
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
        {TRACKS_MAP[selectedGrade]?.map(track => (
          <button
            key={track}
            onClick={() => onSelectTrack(track)}
            className={`p-3 rounded-xl border-2 text-sm font-bold transition-all text-left flex items-center justify-between group ${
              selectedTrack === track
                ? 'bg-accent/10 border-accent text-accent shadow-md'
                : 'bg-surface-low border-transparent text-ink hover:border-accent/30 hover:bg-paper'
            }`}
          >
            {track}
            {selectedTrack === track && <CheckCircle2 className="w-5 h-5" />}
          </button>
        ))}
      </div>
    </motion.div>
  );
};
