import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, Flag, Star, GraduationCap, BookOpen, CalendarDays } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

type HolidayType = 'national' | 'religious' | 'school_break';

interface Holiday {
  date: string;
  name: string;
  type: HolidayType;
}

// Moroccan academic + national holiday calendar (2025–2026)
const HOLIDAYS: Holiday[] = [
  // ── 2025 national holidays ──────────────────────────────────────
  { date: '2025-01-01', name: "New Year's Day", type: 'national' },
  { date: '2025-01-11', name: 'Independence Manifesto Day', type: 'national' },
  { date: '2025-01-13', name: 'Amazigh New Year (Yennayer)', type: 'national' },
  { date: '2025-05-01', name: 'Labour Day', type: 'national' },
  { date: '2025-07-30', name: 'Throne Day', type: 'national' },
  { date: '2025-08-14', name: 'Oued Ed-Dahab Day', type: 'national' },
  { date: '2025-08-20', name: 'Revolution of the King & People', type: 'national' },
  { date: '2025-08-21', name: 'Youth Day', type: 'national' },
  { date: '2025-11-06', name: 'Green March Day', type: 'national' },
  { date: '2025-11-18', name: 'Independence Day', type: 'national' },
  // ── 2025 Islamic / religious (approximate moon-based dates) ──────
  { date: '2025-03-31', name: 'Eid Al-Fitr', type: 'religious' },
  { date: '2025-04-01', name: 'Eid Al-Fitr (2nd day)', type: 'religious' },
  { date: '2025-06-07', name: 'Eid Al-Adha', type: 'religious' },
  { date: '2025-06-08', name: 'Eid Al-Adha (2nd day)', type: 'religious' },
  { date: '2025-06-27', name: 'Islamic New Year (1447)', type: 'religious' },
  { date: '2025-09-05', name: "Prophet's Birthday (Mawlid)", type: 'religious' },
  // ── 2025-2026 school breaks (Ministry of Education) ─────────────
  { date: '2025-06-27', name: 'Summer Vacation Begins', type: 'school_break' },
  { date: '2025-09-09', name: 'Back to School', type: 'school_break' },
  { date: '2025-12-22', name: 'Winter Break Begins', type: 'school_break' },
  { date: '2026-01-05', name: 'Winter Break Ends', type: 'school_break' },
  { date: '2026-03-09', name: 'Spring Break Begins', type: 'school_break' },
  { date: '2026-03-23', name: 'Spring Break Ends', type: 'school_break' },
  { date: '2026-06-26', name: 'Summer Vacation Begins', type: 'school_break' },
  // ── 2026 national holidays ──────────────────────────────────────
  { date: '2026-01-01', name: "New Year's Day", type: 'national' },
  { date: '2026-01-11', name: 'Independence Manifesto Day', type: 'national' },
  { date: '2026-01-13', name: 'Amazigh New Year (Yennayer)', type: 'national' },
  { date: '2026-05-01', name: 'Labour Day', type: 'national' },
  { date: '2026-07-30', name: 'Throne Day', type: 'national' },
  { date: '2026-08-14', name: 'Oued Ed-Dahab Day', type: 'national' },
  { date: '2026-08-20', name: 'Revolution of the King & People', type: 'national' },
  { date: '2026-08-21', name: 'Youth Day', type: 'national' },
  { date: '2026-11-06', name: 'Green March Day', type: 'national' },
  { date: '2026-11-18', name: 'Independence Day', type: 'national' },
  // ── 2026 Islamic / religious ─────────────────────────────────────
  { date: '2026-03-20', name: 'Eid Al-Fitr', type: 'religious' },
  { date: '2026-03-21', name: 'Eid Al-Fitr (2nd day)', type: 'religious' },
  { date: '2026-05-27', name: 'Eid Al-Adha', type: 'religious' },
  { date: '2026-05-28', name: 'Eid Al-Adha (2nd day)', type: 'religious' },
];

const DOT_COLOR: Record<string, string> = {
  national: 'bg-red-500',
  religious: 'bg-emerald-500',
  school_break: 'bg-purple-500',
  exam: 'bg-orange-500',
  controle: 'bg-orange-500',
  event: 'bg-accent',
  general: 'bg-blue-400',
};

const BADGE_COLOR: Record<string, string> = {
  national: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  religious: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  school_break: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  exam: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
  controle: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
  event: 'bg-accent-soft text-accent',
  general: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
};

function EventIcon({ type }: { type: string }) {
  if (type === 'national') return <Flag className="w-3 h-3 shrink-0" />;
  if (type === 'religious') return <Star className="w-3 h-3 shrink-0" />;
  if (type === 'school_break') return <GraduationCap className="w-3 h-3 shrink-0" />;
  if (type === 'exam' || type === 'controle') return <BookOpen className="w-3 h-3 shrink-0" />;
  return <CalendarDays className="w-3 h-3 shrink-0" />;
}

type EventEntry = { type: string; label: string; id?: string };

export const CalendarWidget: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', time: '', type: 'general' as string });

  const scheduleEventsVal = useLiveQuery(() => db.schedule.toArray());
  const tasksVal = useLiveQuery(() => db.tasks.toArray());

  const isLoading = scheduleEventsVal === undefined || tasksVal === undefined;

  const scheduleEvents = scheduleEventsVal ?? [];
  const tasks = tasksVal ?? [];

  // Build date → events map
  const eventsByDate = useMemo(() => {
    const map: Record<string, EventEntry[]> = {};
    const push = (date: string, e: EventEntry) => {
      (map[date] ??= []).push(e);
    };

    HOLIDAYS.forEach(h => push(h.date, { type: h.type, label: h.name }));

    scheduleEvents.forEach(e => {
      if (e.date?.includes('-')) push(e.date, { type: 'event', label: e.title, id: e.id });
    });

    tasks
      .filter(t => t.dueDate && !t.completed)
      .forEach(t => push(t.dueDate!, { type: t.type, label: t.title, id: t.id }));

    return map;
  }, [scheduleEvents, tasks]);

  const calendarDays = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth)),
  }), [currentMonth]);

  const selectedStr = format(selectedDay, 'yyyy-MM-dd');
  const selectedEvents = eventsByDate[selectedStr] ?? [];

  const handleSave = async () => {
    if (!form.title.trim()) return;
    await db.schedule.add({
      id: crypto.randomUUID(),
      date: selectedStr,
      month: format(selectedDay, 'MMMM yyyy'),
      title: form.title,
      time: form.time,
      location: '',
    });
    setForm({ title: '', time: '', type: 'general' });
    setShowAdd(false);
  };

  const handleDelete = async (id: string) => {
    await db.schedule.delete(id);
  };

  return (
    <div className="ls-card-pad space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-950 dark:text-ink leading-tight">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <p className="text-[9px] font-medium text-slate-400 dark:text-ink-muted/60 mt-0.5 uppercase tracking-wider">
            Moroccan Academic Calendar
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-surface-low transition-colors dark:hover:bg-surface-mid"
          >
            <ChevronLeft size={13} className="text-slate-500 dark:text-ink-muted" />
          </button>
          <button
            onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()); }}
            className="px-2 py-1 text-[9px] font-bold text-accent hover:bg-accent-soft rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-surface-low transition-colors dark:hover:bg-surface-mid"
          >
            <ChevronRight size={13} className="text-slate-500 dark:text-ink-muted" />
          </button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-[9px] font-bold text-slate-400/60 dark:text-ink-muted/40 text-center pb-1.5">
            {d}
          </div>
        ))}

        {/* Day cells */}
        {calendarDays.map((day, i) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, currentMonth);
          const todayBool = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDay);
          const dots = (eventsByDate[dateStr] ?? []).slice(0, 3);

          return (
            <button
              key={i}
              onClick={() => setSelectedDay(day)}
              className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg transition-colors ${
                !inMonth ? 'opacity-25 pointer-events-none' : ''
              } ${
                isSelected
                  ? 'bg-accent text-white'
                  : todayBool
                    ? 'bg-accent-soft text-accent font-bold'
                    : 'text-slate-950 dark:text-ink hover:bg-surface-low dark:hover:bg-surface-mid'
              }`}
            >
              <span className="text-[11px] font-medium leading-none">
                {format(day, 'd')}
              </span>
              {dots.length > 0 && (
                <div className="flex gap-px mt-1">
                  {dots.map((ev, di) => (
                    <div
                      key={di}
                      className={`w-[3px] h-[3px] rounded-full ${isSelected ? 'bg-white/70' : (DOT_COLOR[ev.type] ?? 'bg-slate-400')}`}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pb-1">
        {[
          { type: 'national', label: 'National' },
          { type: 'religious', label: 'Religious' },
          { type: 'school_break', label: 'School break' },
          { type: 'exam', label: 'Exam / task' },
          { type: 'event', label: 'My events' },
        ].map(({ type, label }) => (
          <div key={type} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[type]}`} />
            <span className="text-[9px] font-medium text-slate-400 dark:text-ink-muted/50">{label}</span>
          </div>
        ))}
      </div>

      {/* Selected day panel */}
      <div className="border-t border-slate-100 dark:border-white/8 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-950 dark:text-ink">
              {format(selectedDay, 'EEEE, MMM d')}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-ink-muted/60 mt-0.5">
              {isLoading
                ? 'Loading events...'
                : selectedEvents.length === 0
                  ? 'No events'
                  : `${selectedEvents.length} event${selectedEvents.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent text-white text-[10px] font-bold hover:bg-accent-hover transition-colors"
          >
            <Plus size={10} />
            Add event
          </button>
        </div>

        <AnimatePresence mode="popLayout">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-4 flex justify-center items-center"
            >
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </motion.div>
          ) : selectedEvents.length > 0 ? (
            <div className="space-y-1.5">
              {selectedEvents.map((ev, i) => (
                <motion.div
                  key={`${ev.label}-${i}`}
                  layout
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium group ${BADGE_COLOR[ev.type] ?? BADGE_COLOR.general}`}
                >
                  <EventIcon type={ev.type} />
                  <span className="flex-1 truncate">{ev.label}</span>
                  {ev.id && (
                    <button
                      onClick={() => handleDelete(ev.id!)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10"
                    >
                      <X size={10} />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[10px] text-slate-400 dark:text-ink-muted/40 italic"
            >
              Click "Add event" to create something for this day.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Add-event modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              className="absolute inset-0 bg-ink/40"
              onClick={() => setShowAdd(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: 'spring', damping: 26, stiffness: 360 }}
              className="relative w-full max-w-sm bg-white dark:bg-paper rounded-xl p-6 space-y-5"
              style={{ boxShadow: 'var(--ls-shadow-hover)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-accent">New Event</p>
                  <h3 className="text-lg font-bold text-slate-950 dark:text-ink mt-0.5">
                    {format(selectedDay, 'EEEE, MMM d')}
                  </h3>
                </div>
                <button
                  onClick={() => setShowAdd(false)}
                  className="w-8 h-8 rounded-full bg-surface-low flex items-center justify-center text-slate-500 hover:text-slate-950 transition-colors dark:bg-surface-mid dark:text-ink-muted dark:hover:text-ink"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-3">
                <input
                  autoFocus
                  type="text"
                  placeholder="Event title…"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-950 outline-none focus:border-accent/50 transition-all placeholder:text-slate-400 dark:border-white/8 dark:bg-surface-low dark:text-ink dark:placeholder:text-ink-muted"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-400 dark:text-ink-muted/60">Time (optional)</label>
                    <input
                      type="time"
                      value={form.time}
                      onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-950 outline-none focus:border-accent/50 transition-all dark:border-white/8 dark:bg-surface-low dark:text-ink"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-400 dark:text-ink-muted/60">Type</label>
                    <select
                      value={form.type}
                      onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-950 outline-none focus:border-accent/50 transition-all appearance-none dark:border-white/8 dark:bg-surface-low dark:text-ink"
                    >
                      <option value="general">General</option>
                      <option value="exam">Exam</option>
                      <option value="controle">Controle</option>
                      <option value="assignment">Assignment</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-surface-low hover:bg-surface-mid transition-colors dark:bg-surface-mid dark:text-ink-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.title.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-accent hover:bg-accent-hover transition-colors disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
