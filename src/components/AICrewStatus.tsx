import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, X } from 'lucide-react';
import { aiCrew, AITask } from '../services/aiCrewService';
import { getAIStatus, AIStatus } from '../services/geminiService';
import { TaskCard } from './ai-crew/TaskCard';
import { ToggleButton } from './ai-crew/ToggleButton';

export const AICrewStatus: React.FC = () => {
  const [tasks, setTasks] = useState<AITask[]>(aiCrew.getTasks());
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasNewUpdate, setHasNewUpdate] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIStatus>(getAIStatus());

  useEffect(() => {
    const handleStatusUpdate = (event: any) => {
      setAiStatus(event.detail as AIStatus);
    };

    window.addEventListener('ai-status-update', handleStatusUpdate);
    return () => window.removeEventListener('ai-status-update', handleStatusUpdate);
  }, []);

  useEffect(() => {
    const handleUpdate = (event: any) => {
      const newTasks = event.detail as AITask[];
      
      // Check if there's a new task or a status change to "running"
      const hasRunning = newTasks.some(t => t.status === 'running');
      if (hasRunning && !isExpanded) {
        setHasNewUpdate(true);
      }
      
      setTasks(newTasks);
    };

    window.addEventListener('ai-crew-update', handleUpdate);
    return () => window.removeEventListener('ai-crew-update', handleUpdate);
  }, [isExpanded]);

  const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed');

  if (tasks.length === 0) return null;

  return (
    <div
      style={{
        left: 'calc(var(--ls-page-gap, 4px) + 4px)',
        bottom: 'calc(var(--ls-page-gap, 4px) + 4px)',
        width: 'calc(var(--ls-sidebar-width, 220px) - 8px)',
      }}
      className="fixed z-[100] flex flex-col items-stretch gap-[4px] pointer-events-none"
    >
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-80 bg-paper border border-surface-mid rounded-2xl shadow-md overflow-hidden pointer-events-auto flex flex-col max-h-[400px]"
          >
            <div className="p-4 border-b border-surface-mid bg-surface-low/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                  <Users size={16} />
                </div>
                <div>
                  <h2 className="text-[10px] font-bold uppercase tracking-normal text-ink">AI Crew</h2>
                  <p className="text-[8px] text-ink-muted uppercase tracking-wider">Task Queue</p>
                </div>
              </div>
              <button 
                onClick={() => setIsExpanded(false)}
                className="p-1.5 hover:bg-ink/5 rounded-lg text-ink-muted transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {tasks.slice().reverse().map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>

            {completedTasks.length > 0 && (
              <div className="p-3 border-t border-surface-mid bg-surface-low/30 flex gap-2">
                <button 
                  onClick={() => aiCrew.clearCompleted()}
                  className="flex-1 py-2 text-[9px] font-bold text-ink-muted hover:text-ink uppercase tracking-normal transition-colors text-center border border-ink/5 rounded-lg"
                >
                  Clear Completed
                </button>
                <button 
                  onClick={() => aiCrew.clearAll()}
                  className="flex-1 py-2 text-[9px] font-bold text-ink-muted hover:text-error uppercase tracking-normal transition-colors text-center border border-ink/5 rounded-lg"
                >
                  Clear All
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ToggleButton
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        hasNewUpdate={hasNewUpdate}
        setHasNewUpdate={setHasNewUpdate}
        activeTasks={activeTasks}
        aiStatus={aiStatus}
      />
    </div>
  );
};
