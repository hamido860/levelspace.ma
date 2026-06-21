import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, Flag, Star, GraduationCap, BookOpen, CalendarDays, Sparkles, Bell } from 'lucide-react';
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
  national: 'bg-error',
  religious: 'bg-success',
  school_break: 'bg-gold',
  exam: 'bg-warning',
  controle: 'bg-warning',
  event: 'bg-accent',
  general: 'bg-ink-muted',
};

const BADGE_COLOR: Record<string, string> = {
  national: 'bg-error-soft text-error border border-error/10',
  religious: 'bg-success-soft text-success border border-success/10',
  school_break: 'bg-gold-soft text-gold border border-gold/10',
  exam: 'bg-warning-soft text-warning border border-warning/10',
  controle: 'bg-warning-soft text-warning border border-warning/10',
  event: 'bg-accent-soft text-accent border border-accent/10',
  general: 'bg-surface-low text-ink-secondary dark:bg-surface-mid dark:text-ink border border-surface-mid/10',
};

function EventIcon({ type }: { type: string }) {
  if (type === 'national') return <Flag className="w-3.5 h-3.5 shrink-0" />;
  if (type === 'religious') return <Star className="w-3.5 h-3.5 shrink-0" />;
  if (type === 'school_break') return <GraduationCap className="w-3.5 h-3.5 shrink-0" />;
  if (type === 'exam' || type === 'controle') return <BookOpen className="w-3.5 h-3.5 shrink-0" />;
  return <CalendarDays className="w-3.5 h-3.5 shrink-0" />;
}

type EventEntry = { type: string; label: string; id?: string };

const EMPTY_ARRAY: any[] = [];

export const CalendarWidget: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [form, setForm] = useState({ title: '', time: '', type: 'general' as string });
  const [weather, setWeather] = useState<{ temp: number; description: string; bgUrl: string } | null>(null);

  const scheduleEventsVal = useLiveQuery(() => db.schedule.toArray());
  const tasksVal = useLiveQuery(() => db.tasks.toArray());

  const isLoading = scheduleEventsVal === undefined || tasksVal === undefined;

  const scheduleEvents = scheduleEventsVal ?? EMPTY_ARRAY;
  const tasks = tasksVal ?? EMPTY_ARRAY;

  // Fetch current weather for Rabat, Morocco dynamically
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=34.0209&longitude=-6.8416&current_weather=true')
      .then(res => res.json())
      .then(data => {
        if (data?.current_weather) {
          const temp = Math.round(data.current_weather.temperature);
          const code = data.current_weather.weathercode;
          
          let desc = 'Clear Sky';
          let bg = 'https://images.unsplash.com/photo-1504386106331-3e4e71742958?auto=format&fit=crop&q=80&w=600'; // Sunny
          
          if (code === 0) {
            desc = 'Clear Sky';
            bg = 'https://images.unsplash.com/photo-1504386106331-3e4e71742958?auto=format&fit=crop&q=80&w=600';
          } else if (code >= 1 && code <= 3) {
            desc = 'Partly Cloudy';
            bg = 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&q=80&w=600';
          } else if (code === 45 || code === 48) {
            desc = 'Foggy Mist';
            bg = 'https://images.unsplash.com/photo-1487621167305-5d248087c724?auto=format&fit=crop&q=80&w=600';
          } else if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) {
            desc = 'Rain Showers';
            bg = 'https://images.unsplash.com/photo-1438029071396-1e831a7fa6d8?auto=format&fit=crop&q=80&w=600';
          } else if (code >= 71 && code <= 77) {
            desc = 'Snowy Breeze';
            bg = 'https://images.unsplash.com/photo-1483664852095-d6cc6870702d?auto=format&fit=crop&q=80&w=600';
          } else if (code >= 95) {
            desc = 'Thunderstorm';
            bg = 'https://images.unsplash.com/photo-1472141521881-95d0e87e2e39?auto=format&fit=crop&q=80&w=600';
          }
          
          setWeather({ temp, description: desc, bgUrl: bg });
        }
      })
      .catch(() => {
        // Safe Fallback
        setWeather({
          temp: 22,
          description: 'Clear Sky',
          bgUrl: 'https://images.unsplash.com/photo-1504386106331-3e4e71742958?auto=format&fit=crop&q=80&w=600'
        });
      });
  }, []);

  // Build date → events map
  const eventsByDate = useMemo(() => {
    const map: Record<string, EventEntry[]> = {};
    const push = (date: string, e: EventEntry) => {
      (map[date] ??= []).push(e);
    };

    HOLIDAYS.forEach(h => push(h.date, { type: h.type, label: h.name }));

    scheduleEvents.forEach(e => {
      if (e.date?.includes('-')) push(e.date, { type: e.type || 'event', label: e.title, id: e.id });
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
  const selectedEvents = eventsByDate[selectedStr] ?? EMPTY_ARRAY;

  const handleSave = async () => {
    if (!form.title.trim()) return;
    await db.schedule.add({
      id: crypto.randomUUID(),
      date: selectedStr,
      month: format(selectedDay, 'MMMM yyyy'),
      title: form.title,
      time: form.time,
      location: '',
      type: form.type,
    });
    setForm({ title: '', time: '', type: 'general' });
    setShowAdd(false);
  };

  const handleDelete = async (id: string) => {
    await db.schedule.delete(id);
  };

  const EVENT_TYPES = [
    { value: 'general', label: 'General', icon: CalendarDays },
    { value: 'exam', label: 'Exam', icon: BookOpen },
    { value: 'controle', label: 'Controle', icon: Star },
    { value: 'assignment', label: 'Task', icon: GraduationCap },
  ];

  return (
    <div className="relative rounded-2xl border border-surface-mid bg-paper p-4 dark:border-white/5 dark:bg-paper shadow-sm space-y-3 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black bg-gradient-to-r from-ink via-accent to-purple-600 dark:from-white dark:via-accent dark:to-purple-400 bg-clip-text text-transparent leading-tight font-display tracking-tight">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            {weather && (
              <span className="text-[8px] font-mono font-bold bg-accent-soft text-accent border border-accent/15 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                Rabat {weather.temp}°C
              </span>
            )}
          </div>
          <p className="text-[9px] font-bold text-slate-400/80 dark:text-ink-muted/40 mt-0.5 uppercase tracking-wider font-mono">
            Moroccan Academic Calendar
          </p>
        </div>
        
        {/* Navigation, Reminders, and Add buttons row */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 bg-surface-low dark:bg-surface-mid/40 p-0.5 rounded-lg border border-slate-100 dark:border-white/5">
            <button
              onClick={() => setCurrentMonth(m => subMonths(m, 1))}
              className="p-1 rounded hover:bg-white dark:hover:bg-surface-low transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
              aria-label="Previous month"
            >
              <ChevronLeft size={11} className="text-slate-500 dark:text-ink-muted" />
            </button>
            <button
              onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()); }}
              className="px-2 py-0.5 text-[8px] font-mono font-bold text-accent hover:bg-white dark:hover:bg-surface-low rounded-lg transition-all duration-200 cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(m => addMonths(m, 1))}
              className="p-1 rounded hover:bg-white dark:hover:bg-surface-low transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
              aria-label="Next month"
            >
              <ChevronRight size={11} className="text-slate-500 dark:text-ink-muted" />
            </button>
          </div>

          {/* Quick-action Reminders Bell */}
          <button
            onClick={() => setShowReminders(true)}
            className={`relative p-1.5 rounded-lg transition-all duration-200 cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center border ${
              selectedEvents.length > 0
                ? 'bg-accent/15 border-accent/30 text-accent'
                : 'bg-surface-low dark:bg-surface-mid/40 border-slate-100 dark:border-white/5 text-slate-500 dark:text-ink-muted'
            }`}
            title="View Reminders"
            aria-label="View Reminders"
          >
            <Bell size={11} className={selectedEvents.length > 0 ? 'animate-bounce' : ''} />
            {selectedEvents.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-error text-white text-[7px] font-black rounded-full flex items-center justify-center animate-pulse">
                {selectedEvents.length}
              </span>
            )}
          </button>

          {/* Quick-action Add Event Plus */}
          <button
            onClick={() => setShowAdd(true)}
            className="p-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-all duration-200 cursor-pointer shadow-sm hover:scale-105 active:scale-95 flex items-center justify-center border border-accent/20"
            title="Add event"
            aria-label="Add event"
          >
            <Plus size={11} className="text-accent font-bold" />
          </button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 bg-slate-100/40 dark:bg-white/2 p-0.5 rounded-lg border border-slate-100/50 dark:border-white/5 mb-0.5">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-[8px] font-mono font-bold text-slate-400 dark:text-ink-muted/50 text-center py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, i) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, currentMonth);
          const todayBool = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDay);
          const events = eventsByDate[dateStr] ?? EMPTY_ARRAY;
          const dots = events.slice(0, 3);

          // Determine the primary type of event for this day to set background image
          let primaryType = '';
          if (events.length > 0) {
            const types = events.map(e => e.type);
            if (types.includes('national')) primaryType = 'national';
            else if (types.includes('religious')) primaryType = 'religious';
            else if (types.includes('school_break')) primaryType = 'school_break';
            else if (types.includes('exam') || types.includes('controle')) primaryType = 'exam';
            else primaryType = 'event';
          }

          // Background image mapping based on day type
          let cellImg = '';
          if (primaryType === 'national') {
            cellImg = 'https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&q=40&w=120'; // Moroccan theme
          } else if (primaryType === 'religious') {
            cellImg = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=40&w=120'; // Moon/Starry
          } else if (primaryType === 'school_break') {
            cellImg = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=40&w=120'; // School
          } else if (primaryType === 'exam') {
            cellImg = 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=40&w=120'; // Books
          } else if (primaryType === 'event') {
            cellImg = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=40&w=120'; // Workspace
          } else if (todayBool) {
            cellImg = 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=40&w=120'; // Tech Glow
          } else if (inMonth) {
            cellImg = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=20&w=80'; // Abstract wave texture
          }

          return (
            <button
              key={i}
              onClick={() => inMonth && setSelectedDay(day)}
              disabled={!inMonth}
              className={`relative aspect-square w-full flex flex-col items-center justify-between p-1 rounded-lg transition-all duration-200 ease-out hover:scale-108 active:scale-95 cursor-pointer border overflow-hidden ${
                !inMonth
                  ? 'opacity-20 text-slate-300 dark:text-ink-muted/20 border-transparent bg-transparent cursor-default pointer-events-none'
                  : isSelected
                    ? 'bg-gradient-to-tr from-accent via-indigo-500 to-purple-500 text-white shadow-md shadow-accent/25 border-transparent font-bold'
                    : todayBool
                      ? 'border border-accent bg-accent-soft/30 text-accent font-bold shadow-sm'
                      : 'text-slate-950 dark:text-ink hover:bg-surface-low dark:hover:bg-surface-mid/60 border-slate-100/50 dark:border-white/5 bg-slate-50/50 dark:bg-white/2'
              }`}
            >
              {/* Subtle background image overlay inside active day cell */}
              {inMonth && cellImg && !isSelected && (
                <img 
                  src={cellImg} 
                  alt="" 
                  className={`absolute inset-0 object-cover w-full h-full pointer-events-none mix-blend-overlay ${
                    todayBool 
                      ? 'opacity-[0.15] dark:opacity-[0.22]' 
                      : primaryType 
                        ? 'opacity-[0.20] dark:opacity-[0.30]' 
                        : 'opacity-[0.05] dark:opacity-[0.10]'
                  }`} 
                />
              )}

              {/* Day Number */}
              <span className="relative z-10 text-[9px] font-semibold leading-none self-center pt-0.5">
                {format(day, 'd')}
              </span>
              
              {/* Event indicators */}
              <div className="relative z-10 flex gap-0.5 justify-center w-full min-h-[3px] mb-0.5">
                {dots.length > 0 && inMonth && (
                  <>
                    {dots.map((ev, di) => (
                      <div
                        key={di}
                        className={`w-[3px] h-[3px] rounded-full transition-all ${
                          isSelected ? 'bg-white/90 shadow-sm' : (DOT_COLOR[ev.type] ?? 'bg-slate-400')
                        }`}
                      />
                    ))}
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pb-1.5">
        {[
          { type: 'national', label: 'National' },
          { type: 'religious', label: 'Religious' },
          { type: 'school_break', label: 'School break' },
          { type: 'exam', label: 'Exam / task' },
          { type: 'event', label: 'My events' },
        ].map(({ type, label }) => (
          <div key={type} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[type]}`} />
            <span className="text-[8px] font-mono font-bold text-slate-400 dark:text-ink-muted/50">{label}</span>
          </div>
        ))}
      </div>

      {/* Reminders Popover Overlay inside the same card */}
      <AnimatePresence>
        {showReminders && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-x-3 inset-y-3 bg-white/98 dark:bg-[#161B22]/98 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col justify-between shadow-2xl z-20"
          >
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                <div>
                  <span className="text-[8px] font-mono font-bold text-accent uppercase tracking-wider block">Reminders List</span>
                  <h4 className="text-xs font-bold text-slate-950 dark:text-ink font-display tracking-tight leading-none mt-0.5">
                    {format(selectedDay, 'EEEE, MMM d, yyyy')}
                  </h4>
                </div>
                <button
                  onClick={() => setShowReminders(false)}
                  className="w-6 h-6 rounded-full bg-surface-low hover:bg-surface-mid dark:bg-surface-mid dark:text-ink-muted text-slate-500 hover:text-slate-950 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Scrollable reminders list */}
              <div className="overflow-y-auto flex-1 pr-1 space-y-1.5 no-scrollbar">
                {isLoading ? (
                  <div className="py-8 flex justify-center items-center">
                    <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : selectedEvents.length > 0 ? (
                  selectedEvents.map((ev, i) => (
                    <div
                      key={`${ev.label}-${i}`}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[10px] font-medium border ${
                        BADGE_COLOR[ev.type] ?? BADGE_COLOR.general
                      }`}
                    >
                      <div className="p-1 rounded-lg bg-white/20 dark:bg-black/10 shrink-0">
                        <EventIcon type={ev.type} />
                      </div>
                      <span className="flex-1 truncate font-semibold leading-tight">{ev.label}</span>
                      {ev.id && (
                        <button
                          onClick={() => handleDelete(ev.id!)}
                          className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer shrink-0"
                          aria-label="Delete reminder"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <CalendarDays className="w-5 h-5 text-slate-300 dark:text-ink-muted/30 mb-1" />
                    <p className="text-[9px] text-slate-400 dark:text-ink-muted/40 italic">
                      No reminders scheduled today.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-white/5 mt-2">
              <button
                onClick={() => { setShowReminders(false); setShowAdd(true); }}
                className="flex-1 h-8 rounded-lg bg-accent text-white text-[9px] font-bold hover:bg-accent-hover transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 shadow-sm hover:shadow"
              >
                <Plus size={10} />
                Add Event
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
              onClick={() => setShowAdd(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative w-full max-w-[620px] bg-white dark:bg-paper border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-2xl z-10"
            >
              {/* Left Column (Brand Context with Weather Overlay Background) */}
              <div className="w-full md:w-[240px] shrink-0 p-6 bg-gradient-to-br from-slate-950 via-purple-950/90 to-slate-950 border-b md:border-b-0 md:border-r border-white/5 relative overflow-hidden flex flex-col justify-between min-h-[140px] md:min-h-[360px]">
                {/* Weather Backdrop Image with Visible yet Sophisticated Opacity */}
                {weather && (
                  <img
                    src={weather.bgUrl}
                    alt="Weather Backdrop"
                    className="absolute inset-0 object-cover w-full h-full opacity-35 pointer-events-none mix-blend-overlay"
                  />
                )}
                
                {/* Radial Glow */}
                <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.35)_0%,transparent_70%)]" />
                
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 mb-4 shadow-lg shadow-purple-500/10">
                    <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                  </div>
                  <p className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-widest leading-none">
                    Command Center
                  </p>
                  <h4 className="text-sm font-bold text-white mt-2 font-display">
                    Create Dashboard Event
                  </h4>
                  
                  {/* Dynamic weather info pill */}
                  {weather && (
                    <div className="mt-3 flex items-center gap-1.5 bg-white/5 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/5 w-fit">
                      <span className="text-[8px] font-mono font-bold text-white leading-none">
                        {weather.temp}°C
                      </span>
                      <span className="text-[7px] font-mono text-purple-300 leading-none">
                        {weather.description}
                      </span>
                    </div>
                  )}
                </div>

                <div className="relative z-10 border-t border-white/10 pt-4 mt-4 md:mt-0">
                  <span className="text-[28px] font-bold font-mono tracking-tight text-white leading-none">
                    {format(selectedDay, 'dd')}
                  </span>
                  <div className="mt-1">
                    <p className="text-[10px] font-bold font-mono text-purple-300 uppercase tracking-widest">
                      {format(selectedDay, 'MMMM yyyy')}
                    </p>
                    <p className="text-[9px] font-medium text-white/50 uppercase mt-0.5 font-mono">
                      {format(selectedDay, 'EEEE')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column (Form Details) */}
              <div className="p-6 flex-1 bg-paper/60 backdrop-blur-md flex flex-col justify-between space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-mono font-bold text-accent uppercase tracking-wider">Configure Item</span>
                    <h3 className="text-base font-bold text-slate-950 dark:text-ink mt-0.5 font-display">
                      Event Details
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowAdd(false)}
                    className="w-8 h-8 rounded-full bg-surface-low hover:bg-surface-mid text-slate-500 hover:text-slate-950 transition-colors dark:bg-surface-mid dark:text-ink-muted dark:hover:text-ink flex items-center justify-center cursor-pointer active:scale-90"
                    aria-label="Close dialog"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-slate-400 dark:text-ink-muted/60 uppercase tracking-wider block">
                      Title
                    </label>
                    <input
                      autoFocus
                      type="text"
                      placeholder="e.g. Science Exam Prep..."
                      value={form.title}
                      onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleSave()}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-low text-sm text-slate-950 dark:text-ink outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 transition-all placeholder:text-slate-400 dark:placeholder:text-ink-muted/50"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold text-slate-400 dark:text-ink-muted/60 uppercase tracking-wider block">
                        Time (optional)
                      </label>
                      <input
                        type="time"
                        value={form.time}
                        onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-low text-sm text-slate-950 dark:text-ink outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold text-slate-400 dark:text-ink-muted/60 uppercase tracking-wider block">
                        Target Timezone
                      </label>
                      <div className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-surface-low/50 dark:bg-surface-low/30 text-xs text-ink-muted flex items-center font-mono">
                        GMT+01:00 (Rabat)
                      </div>
                    </div>
                  </div>

                  {/* Custom Tactile Select Options */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono font-bold text-slate-400 dark:text-ink-muted/60 uppercase tracking-wider block">
                      Event Category
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {EVENT_TYPES.map(t => {
                        const IconComponent = t.icon;
                        const isSel = form.type === t.value;
                        return (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => setForm(p => ({ ...p, type: t.value }))}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-95 cursor-pointer ${
                              isSel
                                ? 'border-accent/40 bg-accent-soft text-accent shadow-sm shadow-accent/5'
                                : 'border-slate-200 dark:border-white/8 bg-surface-low/40 dark:bg-surface-low/20 text-ink-secondary dark:text-ink-muted hover:border-ink/10 dark:hover:border-white/20'
                            }`}
                          >
                            <IconComponent className="w-3.5 h-3.5 shrink-0" />
                            <span className="capitalize">{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    onClick={() => setShowAdd(false)}
                    className="flex-1 h-11 rounded-xl text-sm font-semibold text-slate-600 bg-surface-low hover:bg-surface-mid transition-all duration-200 dark:bg-surface-mid dark:text-ink-secondary cursor-pointer hover:-translate-y-0.5 active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!form.title.trim()}
                    className="flex-1 h-11 rounded-xl text-sm font-semibold text-white bg-accent hover:bg-accent-hover transition-all duration-200 disabled:opacity-40 disabled:hover:translate-y-0 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95"
                  >
                    Save Event
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
