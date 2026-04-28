import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Users, Loader2, CheckCircle, AlertTriangle, Clock, X, ChevronUp, ChevronDown, Plus, Cpu } from 'lucide-react';
import { aiCrew, AITask } from '../services/aiCrewService';
import { ClassroomAuditReport, getAIStatus, AIStatus } from '../services/geminiService';
import { toast } from 'sonner';

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
    <div className="fixed bottom-6 left-6 z-[100] flex flex-col items-start gap-3 pointer-events-none">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-80 bg-paper border border-surface-mid rounded-2xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[400px]"
          >
            <div className="p-4 border-b border-surface-mid bg-surface-low/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                  <Users size={16} />
                </div>
                <div>
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-ink">Content Pipeline</h2>
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
                <div key={task.id} className="p-3 bg-surface-low rounded-xl border border-surface-mid space-y-2 group transition-all hover:border-accent/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {task.status === 'running' ? (
                        <Loader2 size={12} className="animate-spin text-accent" />
                      ) : task.status === 'completed' ? (
                        <CheckCircle size={12} className="text-success" />
                      ) : task.status === 'failed' ? (
                        <AlertTriangle size={12} className="text-error" />
                      ) : (
                        <Clock size={12} className="text-ink-muted" />
                      )}
                      <span className="text-[10px] font-bold text-ink uppercase tracking-wider">
                        {task.type.replace('_', ' ')}
                      </span>
                    </div>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest ${
                      task.status === 'completed' ? 'bg-success/10 text-success' :
                      task.status === 'failed' ? 'bg-error/10 text-error' :
                      task.status === 'running' ? 'bg-accent/10 text-accent' :
                      'bg-ink/5 text-ink-muted'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-[8px] font-mono text-ink-muted">
                    <span>ID: {task.id.substring(0, 8)}</span>
                    <span>{new Date(task.updatedAt).toLocaleTimeString()}</span>
                  </div>

                  {task.payload && (
                    <div className="text-[9px] text-ink-muted bg-ink/5 p-2 rounded-lg border border-ink/5">
                      {task.type === 'lesson_generation' && task.payload.topic && (
                        <p className="truncate">Topic: <span className="text-ink font-bold">{task.payload.topic}</span></p>
                      )}
                      {(task.type === 'syllabus_generation' || task.type === 'curriculum_audit' || task.type === 'classroom_audit') && task.payload.subject && (
                        <p className="truncate">Subject: <span className="text-ink font-bold">{task.payload.subject}</span></p>
                      )}
                      {task.payload.grade && <p>Grade: {task.payload.grade}</p>}
                      {task.type === 'classroom_audit' && task.payload.moduleName && (
                        <p className="truncate">Classroom: <span className="text-ink font-bold">{task.payload.moduleName}</span></p>
                      )}
                    </div>
                  )}

                  {task.type === 'classroom_audit' && task.status === 'completed' && task.result && (
                    <div className="mt-2 space-y-2 border-t border-ink/5 pt-2">
                      <p className="text-[8px] font-bold text-accent uppercase tracking-widest flex items-center gap-1">
                        <ShieldCheck size={10} />
                        Audit Recommendations
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                        {(task.result as ClassroomAuditReport).todoList.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 p-1.5 bg-paper border border-ink/5 rounded-lg group/item">
                            <div className="flex flex-col">
                              <span className="text-[8px] text-ink font-medium leading-tight">{item.task}</span>
                              <span className="text-[7px] text-ink-muted uppercase tracking-tighter">{item.agent} • {item.priority}</span>
                            </div>
                            <button 
                              onClick={() => {
                                aiCrew.addTask(
                                  item.payload.type === 'lesson_generation' ? 'lesson_generation' : 'lesson_generation', // Fallback to lesson gen for now
                                  {
                                    ...task.payload,
                                    topic: item.payload.topic || item.task
                                  }
                                );
                                toast.success("Task added to content pipeline.");
                              }}
                              className="p-1 bg-accent/10 text-accent rounded hover:bg-accent hover:text-paper transition-colors"
                              title="Delegate to Crew"
                            >
                              <Plus size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {task.error && (
                    <p className="text-[9px] text-error bg-error/5 p-2 rounded-lg border border-error/10 font-mono italic">
                      {task.error}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {completedTasks.length > 0 && (
              <div className="p-3 border-t border-surface-mid bg-surface-low/30 flex gap-2">
                <button 
                  onClick={() => aiCrew.clearCompleted()}
                  className="flex-1 py-2 text-[9px] font-bold text-ink-muted hover:text-ink uppercase tracking-widest transition-colors text-center border border-ink/5 rounded-lg"
                >
                  Clear Completed
                </button>
                <button 
                  onClick={() => aiCrew.clearAll()}
                  className="flex-1 py-2 text-[9px] font-bold text-ink-muted hover:text-error uppercase tracking-widest transition-colors text-center border border-ink/5 rounded-lg"
                >
                  Clear All
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        layout
        onClick={() => {
          setIsExpanded(!isExpanded);
          setHasNewUpdate(false);
        }}
        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl transition-all border ${
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
          <span className="text-[10px] font-bold uppercase tracking-widest leading-none">
            {activeTasks.length > 0 ? 'Pipeline Active' : 'Content Pipeline'}
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

        <div className="ml-2 opacity-50">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
      </motion.button>
    </div>
  );
};
