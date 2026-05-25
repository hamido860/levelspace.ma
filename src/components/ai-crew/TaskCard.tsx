import React from 'react';
import { Loader2, CheckCircle, AlertTriangle, Clock, ShieldCheck, Plus } from 'lucide-react';
import { aiCrew, AITask } from '../../services/aiCrewService';
import { ClassroomAuditReport } from '../../services/geminiService';
import { toast } from 'sonner';

interface TaskCardProps {
  task: AITask;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  return (
    <div className="p-3 bg-surface-low rounded-xl border border-surface-mid space-y-2 group transition-all hover:border-accent/30">
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
        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-normal ${
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
          <p className="text-[8px] font-bold text-accent uppercase tracking-normal flex items-center gap-1">
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
                    toast.success("Task delegated to AI Crew!");
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
  );
};
