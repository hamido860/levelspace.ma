import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  X, Brain, Loader2, Send, RefreshCw, Play, SkipForward,
  Pause, BookOpen, Coffee, Zap, Target, ChevronRight, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { generateSessionPlan, SessionPlan, SessionBlock, ModuleAudit } from '../services/planSessionService';
import { format, differenceInDays } from 'date-fns';

// ─── helpers ────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string; icon: React.ReactNode; dot: string }> = {
  warmup:    { label: 'Warm-up',   color: 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800/40 dark:text-blue-400',    icon: <Zap size={13} />,       dot: 'bg-blue-400' },
  deep_work: { label: 'Deep work', color: 'bg-red-50 border-red-100 text-red-700 dark:bg-red-950/30 dark:border-red-800/40 dark:text-red-400',          icon: <Target size={13} />,    dot: 'bg-red-500'  },
  review:    { label: 'Review',    color: 'bg-purple-50 border-purple-100 text-purple-700 dark:bg-purple-950/30 dark:border-purple-800/40 dark:text-purple-400', icon: <BookOpen size={13} />, dot: 'bg-purple-500' },
  practice:  { label: 'Practice',  color: 'bg-orange-50 border-orange-100 text-orange-700 dark:bg-orange-950/30 dark:border-orange-800/40 dark:text-orange-400', icon: <Target size={13} />, dot: 'bg-orange-500' },
  break:     { label: 'Break',     color: 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-400', icon: <Coffee size={13} />, dot: 'bg-emerald-500' },
};

const LANGS = [
  { code: 'en', flag: '🇬🇧', label: 'English', rtl: false },
  { code: 'fr', flag: '🇫🇷', label: 'Français', rtl: false },
  { code: 'ar', flag: '🇲🇦', label: 'العربية', rtl: true },
  { code: 'dr', flag: '🇲🇦', label: 'دارجة',   rtl: true },
] as const;

type LangCode = typeof LANGS[number]['code'];

const LANG_KEY = 'plan_session_lang';

const QUICK_INTENTS: Record<LangCode, { label: string; minutes: number }[]> = {
  en: [
    { label: 'Prepare for my next exam', minutes: 60 },
    { label: 'I only have 30 minutes', minutes: 30 },
    { label: 'Catch me up on what I missed', minutes: 50 },
    { label: 'Light revision session', minutes: 25 },
  ],
  fr: [
    { label: 'Préparer mon prochain examen', minutes: 60 },
    { label: "Je n'ai que 30 minutes", minutes: 30 },
    { label: 'Rattraper ce que j\'ai manqué', minutes: 50 },
    { label: 'Session de révision légère', minutes: 25 },
  ],
  ar: [
    { label: 'التحضير للامتحان القادم', minutes: 60 },
    { label: 'لدي 30 دقيقة فقط', minutes: 30 },
    { label: 'تعويض الدروس الفائتة', minutes: 50 },
    { label: 'جلسة مراجعة خفيفة', minutes: 25 },
  ],
  dr: [
    { label: 'بغيت نتحضر للامتحان', minutes: 60 },
    { label: 'عندي غير 30 دقيقة', minutes: 30 },
    { label: 'عاودني اللي فاتني', minutes: 50 },
    { label: 'مراجعة خفيفة', minutes: 25 },
  ],
};

// ─── sub-components ─────────────────────────────────────────────────────────

function AuditRow({ a }: { a: ModuleAudit }) {
  const pct = a.total > 0 ? Math.round((a.done / a.total) * 100) : 0;
  const urgent = a.examDaysAway != null && a.examDaysAway <= 7;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {urgent && <AlertTriangle size={11} className="text-orange-500 shrink-0" />}
          <span className="text-xs font-semibold text-slate-950 dark:text-ink">{a.moduleName}</span>
        </div>
        <span className="text-[10px] font-medium text-slate-500 dark:text-ink-muted">
          {a.done}/{a.total} done · <span className={urgent ? 'text-orange-500 font-bold' : 'text-slate-400 dark:text-ink-muted'}>{a.pending.length} left</span>
        </span>
      </div>
      <div className="h-1.5 bg-surface-mid rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${urgent ? 'bg-orange-500' : 'bg-accent'}`}
        />
      </div>
      {a.examLabel && (
        <p className={`text-[10px] font-semibold ${urgent ? 'text-orange-500' : 'text-slate-400 dark:text-ink-muted'}`}>
          ⚠ {a.examLabel}
        </p>
      )}
    </div>
  );
}

function BlockCard({ block, index, active, done }: { block: SessionBlock; index: number; active?: boolean; done?: boolean }) {
  const meta = TYPE_META[block.type] ?? TYPE_META.review;
  if (block.type === 'break') {
    return (
      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${meta.color} ${done ? 'opacity-40' : ''}`}>
        <Coffee size={13} />
        <span className="text-xs font-semibold">{block.duration} min break</span>
        {block.tip && <span className="text-[10px] opacity-70 ml-auto hidden sm:block">{block.tip}</span>}
        {done && <CheckCircle2 size={12} className="ml-auto opacity-60" />}
      </div>
    );
  }
  return (
    <motion.div
      layout
      className={`rounded-2xl border p-4 space-y-2 transition-all ${meta.color} ${active ? 'ring-2 ring-accent ring-offset-2 dark:ring-offset-paper' : ''} ${done ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/50`}>
            {index + 1}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{meta.label} · {block.duration} min</span>
        </div>
        {active && <span className="text-[9px] font-bold bg-accent text-white px-2 py-0.5 rounded-full animate-pulse">Now</span>}
        {done && <CheckCircle2 size={14} className="opacity-50 shrink-0" />}
      </div>
      <div>
        <p className="text-sm font-bold leading-snug">{block.subject}</p>
        <p className="text-xs opacity-80 mt-0.5">{block.lessonTitle}</p>
      </div>
      {block.tip && (
        <p className="text-[10px] opacity-70 leading-relaxed border-t border-black/5 pt-2 mt-1">💡 {block.tip}</p>
      )}
    </motion.div>
  );
}

// ─── Live session HUD ────────────────────────────────────────────────────────

function LiveHUD({
  plan, onClose, onBlockDone,
}: {
  plan: SessionPlan;
  onClose: () => void;
  onBlockDone: (index: number) => void;
}) {
  const navigate = useNavigate();
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
            onClick={() => navigate(`/lesson/${block.lessonId}`)}
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

// ─── Main modal ──────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onStartTimer: (totalMinutes: number) => void;
}

type Phase = 'intent' | 'loading' | 'plan' | 'live';

export const PlanSessionModal: React.FC<Props> = ({ isOpen, onClose, onStartTimer }) => {
  const [phase, setPhase] = useState<Phase>('intent');
  const [input, setInput] = useState('');
  const [minutes, setMinutes] = useState(45);
  const [lang, setLang] = useState<LangCode>(
    () => (localStorage.getItem(LANG_KEY) as LangCode | null) ?? 'en'
  );
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [audits, setAudits] = useState<ModuleAudit[]>([]);
  const [doneBlocks, setDoneBlocks] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const changeLang = (code: LangCode) => {
    setLang(code);
    localStorage.setItem(LANG_KEY, code);
  };

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setPhase('intent');
      setInput('');
      setPlan(null);
      setAudits([]);
      setDoneBlocks(new Set());
      setError(null);
    }
  }, [isOpen]);

  const generate = async (message: string, mins: number) => {
    setPhase('loading');
    setError(null);
    try {
      const result = await generateSessionPlan(message, mins, lang);
      setPlan(result.plan);
      setAudits(result.audits);
      setPhase('plan');
    } catch (e) {
      setError('Could not generate a plan. Check your AI connection.');
      setPhase('intent');
    }
  };

  const handleQuickIntent = (qi: { label: string; minutes: number }) => {
    setMinutes(qi.minutes);
    generate(qi.label, qi.minutes);
  };

  const handleSubmit = () => {
    if (!input.trim()) return;
    generate(input.trim(), minutes);
    setInput('');
  };

  const handleStart = () => {
    if (!plan) return;
    onStartTimer(plan.totalMinutes);
    setPhase('live');
  };

  const handleBlockDone = (index: number) => {
    setDoneBlocks(prev => new Set([...prev, index]));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={phase !== 'live' ? onClose : undefined}
            className="absolute inset-0 bg-ink/50"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            className="relative w-full sm:max-w-lg bg-white dark:bg-paper rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[92vh] overflow-hidden"
            style={{ boxShadow: 'var(--ls-shadow-hover)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-white/8 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center shrink-0">
                  <Brain size={15} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-950 dark:text-ink">Plan Session</h2>
                  <p className="text-[10px] text-slate-400 dark:text-ink-muted">AI-powered study planner</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Language picker */}
                <div className="flex items-center gap-0.5 p-1 rounded-xl bg-surface-low dark:bg-surface-mid">
                  {LANGS.map(l => (
                    <button
                      key={l.code}
                      onClick={() => changeLang(l.code)}
                      title={l.label}
                      className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all ${
                        lang === l.code
                          ? 'bg-white dark:bg-paper shadow-sm scale-105'
                          : 'opacity-50 hover:opacity-80'
                      }`}
                    >
                      {l.flag}
                    </button>
                  ))}
                </div>
                {phase !== 'live' && (
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-surface-low dark:bg-surface-mid flex items-center justify-center text-slate-500 dark:text-ink-muted hover:text-slate-950 dark:hover:text-ink transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <AnimatePresence mode="wait">

                {/* ── Phase: intent ─────────────────────────────── */}
                {phase === 'intent' && (
                  <motion.div
                    key="intent"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-6 space-y-6"
                  >
                    {error && (
                      <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 px-4 py-2 rounded-xl">{error}</p>
                    )}

                    <div>
                      <p className="text-xs font-semibold text-slate-950 dark:text-ink mb-3">What's your goal for this session?</p>
                      <div className="space-y-2" dir={LANGS.find(l => l.code === lang)?.rtl ? 'rtl' : 'ltr'}>
                        {QUICK_INTENTS[lang].map(qi => (
                          <button
                            key={qi.label}
                            onClick={() => handleQuickIntent(qi)}
                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-white/8 bg-white dark:bg-paper text-right hover:border-accent/40 hover:bg-accent-soft/30 transition-all group"
                          >
                            <span className="text-sm text-slate-700 dark:text-ink-secondary group-hover:text-accent transition-colors">{qi.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-ink-muted">{qi.minutes} min</span>
                              <ChevronRight size={13} className="text-slate-300 dark:text-ink-muted/40 group-hover:text-accent transition-colors" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Duration picker */}
                    <div>
                      <p className="text-[10px] font-medium text-slate-400 dark:text-ink-muted mb-2">Or set time manually</p>
                      <div className="flex gap-2">
                        {[20, 30, 45, 60, 90].map(m => (
                          <button
                            key={m}
                            onClick={() => setMinutes(m)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${minutes === m ? 'bg-accent text-white' : 'bg-surface-low dark:bg-surface-mid text-slate-600 dark:text-ink-secondary hover:bg-surface-mid dark:hover:bg-surface-mid/80'}`}
                          >
                            {m}m
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Free text */}
                    <div className="flex gap-2" dir={LANGS.find(l => l.code === lang)?.rtl ? 'rtl' : 'ltr'}>
                      <input
                        ref={inputRef}
                        type="text"
                        placeholder="Or tell me what you need…"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/8 bg-white dark:bg-surface-low text-sm text-slate-950 dark:text-ink placeholder:text-slate-400 dark:placeholder:text-ink-muted outline-none focus:border-accent/50 transition-all"
                      />
                      <button
                        onClick={handleSubmit}
                        disabled={!input.trim()}
                        className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white disabled:opacity-40 hover:bg-accent-hover transition-colors shrink-0"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* ── Phase: loading ────────────────────────────── */}
                {phase === 'loading' && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-6 py-20 flex flex-col items-center justify-center space-y-6"
                  >
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
                        <Brain size={26} className="text-accent" />
                      </div>
                      <Loader2 size={16} className="text-accent animate-spin absolute -bottom-1 -right-1" />
                    </div>
                    <div className="text-center space-y-1.5">
                      <p className="text-sm font-bold text-slate-950 dark:text-ink">Analyzing your lessons…</p>
                      <div className="space-y-0.5 text-[11px] text-slate-400 dark:text-ink-muted">
                        <p>↳ Checking unrevised lessons per subject</p>
                        <p>↳ Finding upcoming exams</p>
                        <p>↳ Building your session plan</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── Phase: plan ───────────────────────────────── */}
                {phase === 'plan' && plan && (
                  <motion.div
                    key="plan"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-6 space-y-6"
                  >
                    {/* AI greeting */}
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-xl bg-accent flex items-center justify-center shrink-0 mt-0.5">
                        <Brain size={13} className="text-white" />
                      </div>
                      <div className="flex-1 bg-surface-low dark:bg-surface-mid rounded-2xl rounded-tl-sm px-4 py-3">
                        <p className="text-sm text-slate-700 dark:text-ink-secondary leading-relaxed">{plan.greeting}</p>
                      </div>
                    </div>

                    {/* Lesson audit snapshot */}
                    {audits.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-ink-muted">Your progress snapshot</p>
                        {audits.slice(0, 4).map(a => (
                          <AuditRow key={a.moduleId} a={a} />
                        ))}
                      </div>
                    )}

                    {/* Session blocks */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-ink-muted">
                        Session plan · {plan.totalMinutes} min total
                      </p>
                      {plan.blocks.map((b, i) => (
                        <BlockCard key={i} block={b} index={i} />
                      ))}
                    </div>

                    {/* Closing message */}
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-xl bg-accent flex items-center justify-center shrink-0 mt-0.5">
                        <Brain size={13} className="text-white" />
                      </div>
                      <div className="flex-1 bg-surface-low dark:bg-surface-mid rounded-2xl rounded-tl-sm px-4 py-3">
                        <p className="text-xs text-slate-500 dark:text-ink-muted leading-relaxed">{plan.close}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setPhase('intent')}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/8 text-xs font-semibold text-slate-600 dark:text-ink-secondary hover:bg-surface-low dark:hover:bg-surface-mid transition-colors"
                      >
                        <RefreshCw size={12} />
                        Adjust
                      </button>
                      <button
                        onClick={handleStart}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent-hover transition-colors"
                      >
                        <Play size={14} />
                        Start session
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* ── Phase: live ───────────────────────────────── */}
                {phase === 'live' && plan && (
                  <motion.div
                    key="live"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-6"
                  >
                    <LiveHUD
                      plan={plan}
                      onClose={onClose}
                      onBlockDone={handleBlockDone}
                    />

                    {/* Mini block list */}
                    <div className="mt-6 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-ink-muted mb-2">All blocks</p>
                      {plan.blocks.map((b, i) => (
                        <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${doneBlocks.has(i) ? 'text-slate-400 dark:text-ink-muted line-through' : 'text-slate-700 dark:text-ink-secondary'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_META[b.type]?.dot ?? 'bg-slate-400'}`} />
                          <span className="font-medium">{b.duration}m</span>
                          <span className="truncate">{b.type === 'break' ? 'Break' : b.subject + ' — ' + b.lessonTitle}</span>
                          {doneBlocks.has(i) && <CheckCircle2 size={11} className="ml-auto shrink-0 text-emerald-500" />}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
