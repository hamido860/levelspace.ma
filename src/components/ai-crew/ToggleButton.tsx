import React from 'react';
import { motion } from 'motion/react';
import { Users, Loader2, Cpu, ChevronDown, ChevronUp } from 'lucide-react';
import { AITask } from '../../services/aiCrewService';
import { AIStatus } from '../../services/geminiService';

interface ToggleButtonProps {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  hasNewUpdate: boolean;
  setHasNewUpdate: (hasNew: boolean) => void;
  activeTasks: AITask[];
  aiStatus: AIStatus;
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({
  isExpanded,
  setIsExpanded,
  hasNewUpdate,
  setHasNewUpdate,
  activeTasks,
  aiStatus,
}) => {
  return (
    <motion.button
      layout
      onClick={() => {
        setIsExpanded(!isExpanded);
        setHasNewUpdate(false);
      }}
      className={`w-full pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-md transition-all border ${
        activeTasks.length > 0
          ? 'bg-accent text-paper border-accent shadow-accent/20'
          : 'bg-paper text-ink border-surface-mid shadow-ink/5'
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative">
        {activeTasks.length > 0 ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Users size={18} />
        )}
        {hasNewUpdate && !isExpanded && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-error rounded-full border-2 border-accent animate-pulse" />
        )}
      </div>

      <div className="flex flex-col items-start">
        <span className="text-[10px] font-bold uppercase tracking-normal leading-none">
          {activeTasks.length > 0 ? 'AI Crew Active' : 'AI Crew'}
        </span>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[8px] opacity-80 uppercase tracking-wider">
            {activeTasks.length > 0 ? `${activeTasks.length} task${activeTasks.length > 1 ? 's' : ''}` : 'Ready'}
          </span>
          <span className="w-1 h-1 rounded-full bg-paper/30" />
          <div className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-tighter bg-paper/10 px-1.5 py-0.5 rounded border border-paper/10">
            <Cpu size={8} />
            {aiStatus.isLocal ? 'Gemma (Local)' : aiStatus.lastModel.replace('gemini-', '').replace('-preview', '').replace('-pro', ' Pro').replace('-flash', ' Flash').replace('-lite', ' Lite')}
          </div>
        </div>
      </div>

      <div className="ml-auto opacity-50">
        {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </div>
    </motion.button>
  );
};
