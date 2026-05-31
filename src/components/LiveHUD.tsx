import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Pause, Play, SkipForward } from 'lucide-react';
import { SessionPlan } from '../services/planSessionService';
import { TYPE_META } from './PlanSessionModal';

// ─── Live session HUD ────────────────────────────────────────────────────────

export function LiveHUD({
  plan, onClose, onBlockDone,
}: {
  plan: SessionPlan;
  onClose: () => void;
  onBlockDone: (index: number) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [blockIndex, setBlockIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(plan.blocks[0].duration * 60);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const block = plan.blocks[blockIndex];
  const totalBlocks = plan.blocks.length;
  const pct = Math.round(100 - (secondsLeft / (block.duration * 60)) * 100);

  useEffect(() => {
    if (running && secondsLeft > 0) {
      intervalRef.current = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    } else if (secondsLeft === 0) {
      advance();
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, secondsLeft]);

  const advance = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    onBlockDone(blockIndex);
    if (blockIndex + 1 < totalBlocks) {
      setBlockIndex(i => i + 1);
      setSecondsLeft(plan.blocks[blockIndex + 1].duration * 60);
      setRunning(true);
    } else {
      onClose();
    }
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const between = [
    "You're making real progress — keep going.",
    "Every minute counts. Stay focused.",
    `${totalBlocks - blockIndex - 1} block${totalBlocks - blockIndex - 1 !== 1 ? 's' : ''} left. You've got this.`,
    "Great work so far. Finish strong.",
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] space-y-8 py-4">
      {/* Block label */}
      <div className="text-center space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-400 dark:text-ink-muted">
          Block {blockIndex + 1} of {totalBlocks} · {TYPE_META[block.type]?.label ?? block.type}
        </p>
        <h2 className="text-xl font-bold text-slate-950 dark:text-ink leading-snug">{block.subject}</h2>
        <p className="text-sm text-slate-500 dark:text-ink-muted">{block.lessonTitle}</p>
      </div>

      {/* Timer ring */}
      <div className="relative w-36 h-36">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="5" className="text-surface-mid" />
          <circle
            cx="50" cy="50" r="44"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeDasharray={`${2 * Math.PI * 44}`}
            strokeDashoffset={`${2 * Math.PI * 44 * (1 - pct / 100)}`}
            strokeLinecap="round"
            className="text-accent transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-slate-950 dark:text-ink">
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-ink-muted mt-0.5">{block.type === 'break' ? 'rest' : 'remaining'}</span>
        </div>
      </div>

      {/* Tip */}
      {block.tip && (
        <p className="text-xs text-slate-500 dark:text-ink-muted text-center max-w-xs leading-relaxed">
          💡 {block.tip}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 w-full max-w-xs">
        {block.lessonId && (
          <button
            onClick={() => navigate(`/lesson/${block.lessonId}`, { state: { from: location.pathname } })}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/8 text-xs font-semibold text-slate-700 dark:text-ink-secondary hover:bg-surface-low dark:hover:bg-surface-mid transition-colors"
          >
            <BookOpen size={13} />
            Open lesson
          </button>
        )}
        <button
          onClick={() => setRunning(r => !r)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-surface-low dark:bg-surface-mid text-xs font-semibold text-slate-700 dark:text-ink-secondary hover:bg-surface-mid transition-colors"
        >
          {running ? <Pause size={13} /> : <Play size={13} />}
          {running ? 'Pause' : 'Resume'}
        </button>
        <button
          onClick={advance}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors"
        >
          <SkipForward size={13} />
          Skip
        </button>
      </div>

      {/* Between-block nudge */}
      <p className="text-[10px] text-slate-400 dark:text-ink-muted/50 text-center">
        {between[blockIndex % between.length]}
      </p>
    </div>
  );
}
