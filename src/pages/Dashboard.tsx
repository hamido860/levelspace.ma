import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Timer,
  BookOpen,
  Calendar as CalendarIcon,
  RefreshCw,
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  Plus,
  Search,
  Clock,
  ArrowRight,
  Brain,
  Sparkles,
  Zap,
  Loader2,
  AlertCircle,
  Cloud,
  Activity,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { TagsManager } from '../components/TagsManager';
import { SEO } from '../components/SEO';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { supabase, checkSupabaseConnection } from '../db/supabase';
import { generateLessonSuggestions, LessonSuggestion, checkAIProvider } from '../services/geminiService';
import { lessonService } from '../services/lessonService';
import { isStudentVisibleLesson } from '../services/lessonRecovery';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { ConnectionStatusModal } from '../components/ConnectionStatusModal';
import { OnboardingModal } from '../components/OnboardingModal';
import { CalendarWidget } from '../components/CalendarWidget';
import { PlanSessionModal } from '../components/PlanSessionModal';
import { SupportZoneModal } from '../components/SupportZoneModal';

const getLessonIllustration = (title: string | null | undefined, category?: string | null | undefined) => {
  const t = String(title || '').toLowerCase();
  const c = String(category || '').toLowerCase();
  
  if (
    t.includes('math') || 
    t.includes('geom') || 
    t.includes('arith') || 
    t.includes('calcul') || 
    t.includes('algebra') || 
    t.includes('suite') || 
    t.includes('série') || 
    t.includes('analyse') || 
    c.includes('math')
  ) {
    return '/illustrations/math_geometry.png';
  }
  if (
    t.includes('physic') || 
    t.includes('physiq') || 
    t.includes('chem') || 
    t.includes('chim') || 
    t.includes('electr') || 
    t.includes('circuit') || 
    t.includes('combust') || 
    c.includes('phys') || 
    c.includes('chim')
  ) {
    return '/illustrations/physics_chemistry.png';
  }
  if (
    t.includes('svt') || 
    t.includes('earth') || 
    t.includes('life') || 
    t.includes('tecton') || 
    t.includes('plaqu') || 
    t.includes('séisme') || 
    t.includes('volcan') || 
    t.includes('roche') || 
    t.includes('géolog') || 
    t.includes('biolog') || 
    c.includes('svt') || 
    c.includes('vie')
  ) {
    return '/illustrations/earth_sciences.png';
  }
  if (
    t.includes('lang') || 
    t.includes('arab') || 
    t.includes('french') || 
    t.includes('franç') || 
    t.includes('read') || 
    t.includes('book') || 
    t.includes('littér') || 
    t.includes('philoso') || 
    t.includes('lexiq') || 
    t.includes('gramm') || 
    t.includes('ortho') || 
    t.includes('conju') || 
    c.includes('lang') || 
    c.includes('fr') || 
    c.includes('ar') || 
    c.includes('phil')
  ) {
    return '/illustrations/humanities_languages.png';
  }
  return '/illustrations/default_edu.png';
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, profile, isPro, signOut, dbConnected, refreshDbConnection, syncData } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [selectedModule, setSelectedModule] = useState<{ id: string, name: string } | null>(null);
  const [isFetchingGallery, setIsFetchingGallery] = useState(false);
  const [suggestions, setSuggestions] = useState<LessonSuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [studySessions, setStudySessions] = useState<{subject: string}[]>([]);
  const [newReminder, setNewReminder] = useState({
    title: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    type: 'general' as const
  });
  const [timerSeconds, setTimerSeconds] = useState(1500); // 25 minutes
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [isPlanSessionOpen, setIsPlanSessionOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [sidebarCollapsedSections, setSidebarCollapsedSections] = useState({
    pomodoro: false,
    support: false,
    stats: false,
  });

  const toggleSidebarSection = (section: 'pomodoro' | 'support' | 'stats') => {
    setSidebarCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  React.useEffect(() => {
    const hasCompleted = localStorage.getItem('has_completed_onboarding');
    if (hasCompleted !== 'true') {
      setIsOnboardingOpen(true);
    }
  }, []);

  const allModulesVal = useLiveQuery(() => db.modules.toArray());
  const allLessonsVal = useLiveQuery(() => db.lessons.toArray());
  
  const allModules = allModulesVal || [];
  const allLessons = allLessonsVal || [];

  const lessonCountByModuleId = useMemo(
    () => allLessons.reduce<Record<string, number>>((acc, l) => {
      acc[l.moduleId] = (acc[l.moduleId] || 0) + 1;
      return acc;
    }, {}),
    [allLessons],
  );

  const lastActivityByModuleId = useMemo(
    () => allLessons.reduce<Record<string, number>>((acc, l) => {
      if (!acc[l.moduleId] || l.createdAt > acc[l.moduleId]) acc[l.moduleId] = l.createdAt;
      return acc;
    }, {}),
    [allLessons],
  );

  const relativeTime = (ts: number) => {
    const diff = Date.now() - ts;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };
  const lastViewedLessonId = useLiveQuery(async () => {
    const setting = await db.settings.get('last_viewed_lesson_id');
    return setting?.value;
  });
  const lastLesson = useLiveQuery(() => lastViewedLessonId ? db.lessons.get(lastViewedLessonId) : undefined, [lastViewedLessonId]);
  const visibleLastLesson = lastLesson && isStudentVisibleLesson(lastLesson) ? lastLesson : undefined;

  const activeModules = useMemo(() => allModules.filter(m => m.selected), [allModules]);
  const remindersVal = useLiveQuery(() => db.tasks.toArray());
  const scheduleVal = useLiveQuery(() => db.schedule.toArray());
  const dbSettingsVal = useLiveQuery(() => db.settings.toArray());

  const isLoading = allModulesVal === undefined || allLessonsVal === undefined || remindersVal === undefined || scheduleVal === undefined || dbSettingsVal === undefined;
  
  const reminders = remindersVal || [];
  const schedule = scheduleVal || [];
  const dbSettings = dbSettingsVal || [];
  const settingsMap = useMemo(() => Object.fromEntries(dbSettings.map(s => [s.key, s.value])), [dbSettings]);

  const selectedGrade = settingsMap['selected_grade'] || localStorage.getItem('selected_grade') || 'Grade 12';
  const selectedCountry = settingsMap['selected_country'] || localStorage.getItem('selected_country') || '';
  const currentSession = settingsMap['current_session'] || localStorage.getItem('current_session') || 'Fall 2024';
  const defaultDuration = Number(settingsMap['default_session_duration'] || localStorage.getItem('default_session_duration') || 25);

  const toggleReminder = async (id: string) => {
    const task = await db.tasks.get(id);
    if (task) {
      await db.tasks.update(id, { completed: !task.completed });
    }
  };

  const handleModuleClick = (moduleId: string, moduleName: string) => {
    console.log("Module clicked:", moduleName, moduleId);
    setSelectedModule({ id: moduleId, name: moduleName });
    setSuggestions([]);

    if (!checkAIProvider()) {
      setIsFetchingGallery(false);
      return;
    }

    setIsFetchingGallery(true);
    const grade = selectedGrade;
    const country = selectedCountry;

    // Fetch in background
    generateLessonSuggestions(moduleName, grade, country)
      .then(gallery => {
        setSuggestions(gallery);
      })
      .catch(error => {
        console.error("Failed to fetch gallery:", error);
      })
      .finally(() => {
        setIsFetchingGallery(false);
      });
  };

  const handleCurateFromGallery = async (title: string) => {
    if (!selectedModule) return;
    
    if (!isPro && activeModules.length >= 3) {
      alert('Free plan is limited to 3 active modules. Please upgrade to Pro for unlimited modules!');
      navigate('/pricing');
      return;
    }

    setIsGenerating(true);
    
    const grade = selectedGrade;
    const country = selectedCountry;
    
    try {
      const lesson = await lessonService.fetchOrGenerate({
        title,
        grade,
        country,
        moduleId: selectedModule.id
      }, user?.id || '');
      
      if (lesson) {
        const newLessonId = lesson.id || crypto.randomUUID();
        await db.lessons.put({
          id: newLessonId,
          moduleId: selectedModule.id,
          title: lesson.title,
          content: '',
          blocks: (lesson.blocks || []) as any,
          subtitle: lesson.subtitle,
          // _pending means AI Crew is generating it — save as 'pending' so LessonView shows progress UI
          status: (lesson as any)._pending ? 'pending' : 'done',
          createdAt: Date.now()
        });
        navigate(`/lesson/${newLessonId}`, { state: { from: '/dashboard', moduleId: selectedModule.id } });
      }
    } catch (error) {
      console.error("Failed to fetch or generate lesson:", error);
    } finally {
      setIsGenerating(false);
      setSelectedModule(null);
    }
  };

  const handleSaveReminder = async () => {
    if (!newReminder.title.trim()) return;
    
    await db.tasks.add({
      id: crypto.randomUUID(),
      title: newReminder.title,
      completed: false,
      dueDate: newReminder.dueDate,
      type: newReminder.type,
      createdAt: Date.now()
    });
    
    setIsReminderModalOpen(false);
    setNewReminder({
      title: '',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      type: 'general'
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  React.useEffect(() => {
    if (defaultDuration) {
      setTimerSeconds(defaultDuration * 60);
    }
  }, [defaultDuration]);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  React.useEffect(() => {
    if (isReminderModalOpen) {
      const saved = localStorage.getItem('study_sessions');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setStudySessions(parsed);
          }
        } catch (e) {
          console.error("Error loading study sessions", e);
        }
      }
    }
  }, [isReminderModalOpen]);

  return (
    <Layout fullWidth>
      <SEO title="Dashboard" />
      <div className="h-full w-full bg-background flex flex-col overflow-hidden p-4">
        
        {/* Symmetrical Layout Container */}
        <div className="flex-grow min-h-0 w-full flex flex-col lg:flex-row gap-3 overflow-hidden">
          
          {/* Column 2: Main Dashboard Content (Middle Column, flex-grow) */}
          <div className="flex-grow flex flex-col min-h-0 w-full overflow-hidden bg-white dark:bg-paper rounded-xl shadow-lg border border-slate-200 dark:border-white/8 p-6">
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-6">
              {/* Page Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-5">
                <h1 className="ls-page-title text-slate-950 dark:text-ink">
                  {t('dashboard') || 'Dashboard'}
                </h1>
                <button
                  type="button"
                  onClick={() => setShowMetrics(current => !current)}
                  aria-expanded={showMetrics}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700 dark:text-ink-muted dark:hover:bg-white/5 dark:hover:text-ink"
                >
                  {showMetrics ? 'Hide metrics' : 'Show metrics'}
                  {showMetrics ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>

              {showMetrics && <section className="mt-2">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Focus Quotient', value: '8.4', unit: '/10', icon: <Brain />, trend: '+12%' },
                    { label: 'Deep Work Total', value: '24.5', unit: 'hrs', icon: <Timer />, trend: '+4.2h' },
                    { label: 'Mastery Delta', value: '+18', unit: '%', icon: <Zap />, trend: 'Optimal' },
                    { label: 'Lessons to Review', value: '2', unit: '', icon: <AlertCircle />, trend: '-1 this week' }
                  ].map((stat, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      viewport={{ once: true }}
                      className="bg-slate-50/50 dark:bg-surface-low/30 p-5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-3 shadow-sm hover:border-accent/30 transition-all cursor-default"
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-surface-low flex items-center justify-center text-slate-400 dark:text-ink-muted">
                          {React.cloneElement(stat.icon as React.ReactElement<any>, { size: 16 })}
                        </div>
                        <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-normal">{stat.trend}</span>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-normal">{stat.label}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-slate-800 dark:text-ink">{stat.value}</span>
                          <span className="text-[10px] font-medium text-slate-400 dark:text-ink-muted">{stat.unit}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>}

              {/* Bottom Utilities: Interactive Calendar & Upcoming Assignments Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                
                {/* Academic Calendar Utility */}
                <div className="flex flex-col min-h-0">
                  <CalendarWidget />
                </div>

                {/* Upcoming Assignments Utility */}
                <div className="bg-white dark:bg-paper rounded-2xl border border-slate-200 dark:border-white/8 p-5 shadow-sm space-y-4 flex flex-col min-h-0">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-ink">
                      <BookOpen className="w-4.5 h-4.5 text-accent shrink-0" />
                      <h3 className="text-sm font-bold">{t('upcoming_assignments') || 'Upcoming Assignments'}</h3>
                    </div>
                    <button 
                      onClick={() => setIsReminderModalOpen(true)} 
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
                    >
                      <Plus size={12} /> {t('add') || 'Add'}
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-3 overflow-y-auto no-scrollbar max-h-[360px]">
                    {isLoading ? (
                      <div className="py-12 flex justify-center items-center">
                        <Loader2 className="w-5 h-5 text-accent animate-spin" />
                      </div>
                    ) : reminders.filter(r => !r.completed).length > 0 ? (
                      reminders
                        .filter(r => !r.completed)
                        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
                        .slice(0, 5)
                        .map((reminder, i) => (
                          <motion.div 
                            key={reminder.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-slate-50/50 dark:bg-surface-low/30 border border-slate-100 dark:border-white/5 p-4 rounded-xl flex items-center justify-between group shadow-sm hover:border-accent/30 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                reminder.type === 'exam' || reminder.type === 'controle' 
                                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' 
                                  : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                              }`}>
                                {reminder.type === 'exam' || reminder.type === 'controle' ? <AlertCircle size={18} /> : <BookOpen size={18} />}
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-slate-950 line-clamp-1 dark:text-ink">{reminder.title}</h4>
                                <p className="text-xs font-medium text-slate-500 mt-0.5 dark:text-ink-muted">
                                  {reminder.dueDate ? format(new Date(reminder.dueDate), 'MMM dd, yyyy') : 'No date'}
                                </p>
                              </div>
                            </div>
                            <button 
                              onClick={() => toggleReminder(reminder.id)}
                              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all dark:border-white/10 dark:hover:bg-emerald-500/10"
                            >
                              <Check size={14} />
                            </button>
                          </motion.div>
                        ))
                    ) : (
                      <div className="py-12 text-center bg-slate-50/30 dark:bg-surface-low/10 rounded-xl border border-solid border-slate-100 dark:border-white/5">
                        <p className="text-xs font-medium text-slate-500 dark:text-ink-muted">
                          {t('no_pending_reminders') || 'No upcoming assignments. You are all caught up!'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Column 3: Dashboard Widgets Sidebar (Right Column, 260px width) */}
          <div className="flex lg:w-[234px] w-full shrink-0 h-full bg-white dark:bg-paper rounded-xl shadow-lg border border-slate-200 dark:border-white/8 overflow-hidden flex-col p-5">
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-6 pr-1">
              
              {/* Deep Focus Pomodoro - Premium Calmer Box */}
              <section className="bg-slate-900 text-white rounded-2xl p-5 relative dark:bg-surface-low">
                <button 
                  type="button" 
                  onClick={() => toggleSidebarSection('pomodoro')} 
                  className="w-full flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider dark:text-ink-muted outline-none"
                >
                  <span>Deep Focus</span>
                  {sidebarCollapsedSections.pomodoro ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
                
                <AnimatePresence initial={false}>
                  {!sidebarCollapsedSections.pomodoro && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-3"
                    >
                      <div className="text-3xl font-bold tracking-tight mb-3 text-white dark:text-ink">{formatTime(timerSeconds)}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsTimerRunning(!isTimerRunning)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            isTimerRunning ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-white text-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          {isTimerRunning ? 'Pause' : 'Start Timer'}
                        </button>
                        <button
                          onClick={() => { setIsTimerRunning(false); setTimerSeconds(defaultDuration * 60); }}
                          className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-700 transition-all dark:bg-surface-mid"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Support Zone / MyLevel - Collapsible & Premium borderless box */}
              <section className="space-y-3">
                <button 
                  type="button" 
                  onClick={() => toggleSidebarSection('support')}
                  className="w-full flex items-center justify-between text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider outline-none"
                >
                  <span>Support Zone</span>
                  {sidebarCollapsedSections.support ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                </button>
                
                <AnimatePresence initial={false}>
                  {!sidebarCollapsedSections.support && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-1"
                    >
                      <div className="p-4 bg-slate-50 dark:bg-surface-low/30 rounded-2xl border border-slate-100 dark:border-white/5 space-y-4 shadow-sm">
                        <p className="text-xs text-slate-600 dark:text-ink-secondary leading-relaxed">
                          Check your real level, discover your gaps, and get a personal roadmap.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsSupportModalOpen(true)}
                          className="w-full py-2.5 rounded-xl text-xs font-bold transition-all bg-slate-900 text-white hover:bg-slate-800 dark:bg-white/10 dark:hover:bg-white/20"
                        >
                          Start MyLevel Check
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Learning Stats - Collapsible & Premium borderless box */}
              <section className="space-y-3">
                <button 
                  type="button" 
                  onClick={() => toggleSidebarSection('stats')}
                  className="w-full flex items-center justify-between text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider outline-none"
                >
                  <span>Learning Stats</span>
                  {sidebarCollapsedSections.stats ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                </button>
                
                <AnimatePresence initial={false}>
                  {!sidebarCollapsedSections.stats && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mt-1"
                    >
                      <div className="p-4 bg-slate-50 dark:bg-surface-low/30 rounded-2xl border border-slate-100 dark:border-white/5 space-y-3 shadow-sm">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 dark:text-ink-muted">{t('active_modules') || 'Active Modules'}</span>
                          <span className="font-bold text-slate-800 dark:text-ink">{activeModules.length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 dark:text-ink-muted">{t('avg_completion') || 'Avg Completion'}</span>
                          <span className="font-bold text-slate-800 dark:text-ink">
                            {Math.round(activeModules.reduce((acc, m) => acc + m.progress, 0) / (activeModules.length || 1))}%
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

            </div>
          </div>
        </div>
      
        {/* Floating Action Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/modules')}
          className="fixed bottom-8 right-8 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 z-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100" style={{ boxShadow: 'var(--ls-shadow-hover)' }}
        >
          <Plus className="w-4 h-4" />
          New classroom
        </motion.button>
      </div>

      {/* Audit Modal */}
      <Modal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        title={t('curriculum_audit')}
      >
        <div className="space-y-6">
          <div className="p-6 bg-accent/5 rounded-2xl border border-accent/10 space-y-4">
            <div className="flex items-center gap-3 text-accent">
              <Brain className="w-6 h-6" />
              <h3 className="font-bold text-lg">{t('ai_auditor')}</h3>
            </div>
            <p className="ls-body-text leading-relaxed">
              {t('audit_description', { grade: selectedGrade, country: selectedCountry })}
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="ls-micro-label">{t('audit_parameters')}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 dark:bg-surface-low dark:border-white/8">
                <p className="ls-micro-label mb-1">{t('grade')}</p>
                <p className="text-sm font-bold text-slate-950 dark:text-ink">{selectedGrade}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 dark:bg-surface-low dark:border-white/8">
                <p className="ls-micro-label mb-1">{t('region')}</p>
                <p className="text-sm font-bold text-slate-950 dark:text-ink">{selectedCountry}</p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => {
              setShowAuditModal(false);
              // In a real app, this would trigger a background audit process
              alert(t('audit_started'));
            }}
            className="w-full py-4 bg-slate-950 text-white rounded-xl text-xs font-bold hover:bg-accent transition-all dark:bg-white dark:text-slate-950 dark:hover:bg-accent dark:hover:text-white"
          >
            {t('run_deep_audit')}
          </button>
        </div>
      </Modal>

      {/* Reminder Modal */}
      <Modal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        title={t('add_reminder')}
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="ls-micro-label">{t('title')}</label>
              <input 
                type="text"
                list="session-titles"
                value={newReminder.title}
                onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                placeholder={t('e_g_math_exam')}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-950 focus:outline-none focus:border-accent/30 transition-all dark:bg-surface-low dark:border-white/8 dark:text-ink dark:placeholder:text-ink-muted"
              />
              <datalist id="session-titles">
                {activeModules.map(m => (
                  <option key={m.id} value={m.name} />
                ))}
                {Array.from(new Set(studySessions.map(s => s.subject))).map((subject, idx) => (
                  <option key={idx} value={subject} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="ls-micro-label">{t('due_date')}</label>
                <input 
                  type="date"
                  value={newReminder.dueDate}
                  onChange={(e) => setNewReminder({ ...newReminder, dueDate: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-950 focus:outline-none focus:border-accent/30 transition-all dark:bg-surface-low dark:border-white/8 dark:text-ink"
                />
              </div>
              <div className="space-y-2">
                <label className="ls-micro-label">{t('type')}</label>
                <select
                  value={newReminder.type}
                  onChange={(e) => setNewReminder({ ...newReminder, type: e.target.value as any })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-950 focus:outline-none focus:border-accent/30 transition-all appearance-none dark:bg-surface-low dark:border-white/8 dark:text-ink"
                >
                  <option value="general">{t('general')}</option>
                  <option value="exam">{t('exam')}</option>
                  <option value="controle">{t('controle')}</option>
                  <option value="assignment">{t('assignment')}</option>
                  <option value="reading">{t('reading')}</option>
                  <option value="quiz">{t('quiz')}</option>
                </select>
              </div>
            </div>
          </div>

          <button 
            onClick={handleSaveReminder}
            className="w-full py-4 bg-accent text-white rounded-xl text-xs font-bold  hover:bg-slate-950 hover:text-white transition-all "
          >
            {t('save_profile')}
          </button>
        </div>
      </Modal>

      {/* Module Gallery Modal */}
      <Modal 
        isOpen={!!selectedModule} 
        onClose={() => setSelectedModule(null)}
        title={selectedModule?.name || ''}
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-accent">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-medium">{t('suggested_units')}</span>
            </div>
            <p className="ls-body-text leading-relaxed">
              {t('suggested_units_description', { grade: selectedGrade, country: selectedCountry })}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {isFetchingGallery ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="ls-micro-label font-medium animate-pulse">{t('consulting_resources')}</p>
              </div>
            ) : (
              suggestions.map((suggestion, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleCurateFromGallery(suggestion.title)}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-accent/30 hover:bg-white hover:shadow-sm transition-all cursor-pointer group flex items-center justify-between dark:bg-surface-low dark:border-white/8 dark:hover:bg-surface-mid dark:hover:border-accent/30"
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-950 group-hover:text-accent transition-colors dark:text-ink">{suggestion.title}</h4>
                    <p className="text-[11px] text-slate-500 line-clamp-1 dark:text-ink-muted">{suggestion.description}</p>
                  </div>
                  <Plus size={16} className="text-slate-500 group-hover:text-accent transition-colors dark:text-ink-muted" />
                </motion.div>
              ))
            )}
          </div>
          <div 
            onClick={() => navigate('/modules')}
            className="group relative bg-slate-50 border border-solid border-ink/20 rounded-2xl hover:border-accent/50 transition-all cursor-pointer p-6 flex flex-col items-center justify-center space-y-4 dark:bg-surface-low dark:border-white/8"
          >
            <div className="w-12 h-12 rounded-full bg-accent/5 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all">
              <Plus size={24} />
            </div>
            <span className="text-sm font-bold text-slate-950 dark:text-ink">{t('actions_create_classroom')}</span>
          </div>

          {!isFetchingGallery && (
            <button 
              onClick={() => navigate(`/classroom/${selectedModule?.id}`)}
              className="w-full py-4 bg-slate-950 text-white rounded-xl text-xs font-bold hover:bg-accent transition-all flex items-center justify-center gap-2 dark:bg-white dark:text-slate-950 dark:hover:bg-accent dark:hover:text-white"
            >
              {t('go_to_classroom')}
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </Modal>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#0D1117]/90  flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full animate-pulse" />
              <Brain className="w-16 h-16 text-accent relative z-10 animate-bounce" />
            </div>
            <div className="space-y-4 max-w-sm">
              <h3 className="text-2xl font-bold text-white font-display">{t('curating_knowledge')}</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                {t('curating_description')}
              </p>
              <div className="flex items-center justify-center gap-2 text-accent">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-medium">{t('synthesizing_blocks')}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <PlanSessionModal
        isOpen={isPlanSessionOpen}
        onClose={() => setIsPlanSessionOpen(false)}
        onStartTimer={(totalMinutes) => {
          setTimerSeconds(totalMinutes * 60);
          setIsTimerRunning(true);
          setIsPlanSessionOpen(false);
        }}
      />
      <ConnectionStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        onRefresh={refreshDbConnection}
      />
      
      <OnboardingModal 
        isOpen={isOnboardingOpen}
        onComplete={() => {
          setIsOnboardingOpen(false);
        }}
      />

      <SupportZoneModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        grade={profile?.grade || "Grade 9"}
      />
    </Layout>
  );
};
