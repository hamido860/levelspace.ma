import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Timer,
  BookOpen,
  Calendar as CalendarIcon,
  RefreshCw,
  Settings,
  ChevronRight,
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
  Cloud
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

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, profile, isPro, signOut, dbConnected, refreshDbConnection, syncData } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
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

  React.useEffect(() => {
    const hasCompleted = localStorage.getItem('has_completed_onboarding');
    if (hasCompleted !== 'true') {
      setIsOnboardingOpen(true);
    }
  }, []);

  const allModules = useLiveQuery(() => db.modules.toArray()) || [];
  const lastViewedLessonId = useLiveQuery(async () => {
    const setting = await db.settings.get('last_viewed_lesson_id');
    return setting?.value;
  });
  const lastLesson = useLiveQuery(() => lastViewedLessonId ? db.lessons.get(lastViewedLessonId) : undefined, [lastViewedLessonId]);
  const visibleLastLesson = lastLesson && isStudentVisibleLesson(lastLesson) ? lastLesson : undefined;

  const activeModules = useMemo(() => allModules.filter(m => m.selected), [allModules]);
  const reminders = useLiveQuery(() => db.tasks.toArray()) || [];
  const schedule = useLiveQuery(() => db.schedule.toArray()) || [];
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
  const settingsMap = useMemo(() => Object.fromEntries(dbSettings.map(s => [s.key, s.value])), [dbSettings]);

  const selectedGrade = settingsMap['selected_grade'] || localStorage.getItem('selected_grade') || 'Grade 12';
  const selectedCountry = settingsMap['selected_country'] || localStorage.getItem('selected_country') || '';
  const currentSession = settingsMap['current_session'] || localStorage.getItem('current_session') || 'Fall 2024';
  const defaultDuration = Number(settingsMap['default_session_duration'] || localStorage.getItem('default_session_duration') || 25);

  // ⚡ Bolt: Memoize derived arrays to prevent expensive O(N log N) recalculations on timer tick re-renders
  const upcomingExams = useMemo(() =>
    reminders
      .filter(r => (r.type === 'exam' || r.type === 'controle') && !r.completed)
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
      .slice(0, 3)
  , [reminders]);

  // ⚡ Bolt: Memoize filtered array to prevent allocating new object references on every re-render
  const generalReminders = useMemo(() =>
    reminders
      .filter(r => r.type !== 'exam' && r.type !== 'controle' && !r.completed)
      .slice(0, 3)
  , [reminders]);

  // ⚡ Bolt: Memoize sorting of schedule to save CPU cycles during frequent timer ticks
  const upcomingEvents = useMemo(() =>
    schedule
      .filter(e => e.date?.includes('-'))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3)
  , [schedule]);

  // ⚡ Bolt: Memoize expensive Set creation for dropdown options
  const uniqueSubjects = useMemo(() =>
    Array.from(new Set(studySessions.map(s => s.subject)))
  , [studySessions]);

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
        navigate(`/lesson/${newLessonId}`);
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
    <Layout>
      <SEO title="Dashboard" />
      <div className="max-w-7xl mx-auto space-y-12 pb-20 relative">
        {/* Top Bar - Minimal Actions */}
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center ">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-950 leading-tight dark:text-ink">{t('dashboard')}</h1>
              <p className="ls-micro-label">{t('academic_repository')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/pricing')}
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                isPro 
                  ? 'bg-accent/10 border-accent/20 text-accent shadow-sm' 
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-paper dark:border-white/10 dark:text-ink-muted dark:hover:border-white/20'
              }`}
            >
              {isPro ? <Sparkles className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
              {isPro ? 'Pro Member' : 'Free Plan'}
            </button>
            {dbConnected !== null && (
              <div className="flex items-center gap-1">
                <button 
                  onClick={async () => {
                    setIsSyncing(true);
                    try {
                      const results = await syncData();
                      if (results.errors.length > 0) {
                        alert(`Sync completed with errors:\n${results.errors.join('\n')}`);
                      } else {
                        alert(`Sync successful!\nModules: ${results.modules}\nLessons: ${results.lessons}\nTasks: ${results.tasks}`);
                      }
                    } catch (err) {
                      alert('Sync failed. Please check your connection.');
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  disabled={isSyncing || !dbConnected}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${dbConnected ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-error/10 border-error/20 text-error'} text-[11px] font-semibold  transition-all disabled:opacity-50`}
                >
                  {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3" />}
                  {isSyncing ? 'Syncing...' : 'Sync to Cloud'}
                </button>
                <button 
                  onClick={() => setIsStatusModalOpen(true)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${dbConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-error/10 border-error/20 text-error'} text-[11px] font-semibold  transition-all`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${dbConnected ? 'bg-emerald-500' : 'bg-error'} animate-pulse`} />
                  {dbConnected ? 'Cloud Connected' : 'Local Only'}
                </button>
                <button 
                  onClick={async () => {
                    await refreshDbConnection();
                  }}
                  className="p-1.5 hover:bg-slate-950/5 rounded-full text-slate-500 transition-all dark:text-ink-muted dark:hover:bg-surface-low"
                  title="Refresh Connection"
                >
                  <RefreshCw className={`w-3 h-3 ${dbConnected === null ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
            <button 
              onClick={() => setShowAuditModal(true)}
              className="flex items-center gap-2 px-4 py-2 ls-card ls-micro-label hover:border-accent/30 hover:text-accent transition-all"
            >
              <Search className="w-3.5 h-3.5" />
              {t('run_audit')}
            </button>
            <button 
              onClick={async () => {
                if (confirm(t('reset_confirm'))) {
                  await db.modules.clear();
                  await db.lessons.clear();
                  await db.tasks.clear();
                  await db.schedule.clear();
                  localStorage.removeItem('curated_modules');
                  window.location.reload();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 ls-card text-xs font-medium text-error/60  hover:bg-error/5 hover:text-error transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('reset')}
            </button>
          </div>
        </div>

        {/* Hero Section - Minimal & Clean */}
        <section className="relative overflow-hidden ls-card-pad mx-4 p-8">
          <div className="relative z-10 max-w-lg space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <p className="ls-status-badge">
                  {t('personalized_for', { grade: selectedGrade })}
                </p>
                <div className="w-1 h-1 rounded-full bg-slate-950/20" />
                <p className="text-xs font-medium text-slate-500 dark:text-ink-muted">
                  {currentSession}
                </p>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                {t('motivation_power')}
              </h1>
            </div>

            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => navigate('/modules')}
                className="ls-button-primary"
              >
                {t('dashboard_explore')}
              </button>
              <button 
                onClick={() => navigate('/blueprints')}
                className="ls-button-secondary"
              >
                {t('view_blueprints')}
              </button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 px-4">
          {/* Main Content - Classrooms */}
          <div className="lg:col-span-8 space-y-8">
            {/* Last Lesson Quick Action */}
            {visibleLastLesson && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/lesson/${visibleLastLesson.id}`)}
                className="ls-interactive-card-pad flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="ls-icon-tile">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <p className="ls-micro-label">Continue Learning</p>
                    <h3 className="text-sm font-bold text-slate-950 dark:text-ink">{visibleLastLesson.title}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-ink-secondary">
                  <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Resume</span>
                  <ChevronRight size={18} />
                </div>
              </motion.div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="ls-section-title">{t('active_classrooms')}</h2>
                <p className="ls-body-text">{t('active_paths_desc')}</p>
              </div>
              <button 
                onClick={() => navigate('/modules')}
                className="ls-button-secondary"
              >
                {t('manage')} <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {allModules.length > 0 ? (
                allModules.map((module, i) => (
                  <motion.div
                    key={module.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleModuleClick(module.id, module.name)}
                    className="group relative ls-interactive-card cursor-pointer p-6 space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <span className="ls-badge">
                        {module.code}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={module.selected ? 'ls-status-badge' : 'ls-badge'}>{module.selected ? t('active') : t('inactive')}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-950 leading-tight group-hover:text-accent transition-colors dark:text-ink">
                        {module.name}
                      </h3>
                      <p className="ls-body-text line-clamp-2 leading-relaxed">
                        {module.description}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between ls-micro-label">
                        <span>{t('progress')}</span>
                        <span>{module.progress}%</span>
                      </div>
                      <div className="h-[4.5px] bg-surface-low rounded-full overflow-hidden dark:bg-surface-mid">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${module.progress}%` }}
                          className="h-full bg-accent"
                        />
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-20 bg-slate-50/30 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 dark:bg-surface-low/20 dark:border-white/8">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center dark:bg-surface-mid" style={{ boxShadow: 'var(--ls-shadow)' }}>
                    <BookOpen className="w-6 h-6 text-slate-500 dark:text-ink-muted" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-950 dark:text-ink">{t('dashboard_explore')}</p>
                    <p className="ls-micro-label">{t('dashboard_continue')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Focus & Agenda */}
          <div className="lg:col-span-4 space-y-8">
            {/* Focus Timer Card */}
            <section className="bg-[#0D1117] text-white rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-white/60">{t('deep_focus')}</h3>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isTimerRunning ? 'bg-accent animate-pulse' : 'bg-white/20'}`} />
                  <span className="text-xs font-medium text-white/60 ">
                    {isTimerRunning ? t('active') : t('idle')}
                  </span>
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-5xl font-bold tracking-tighter mb-1">
                  {formatTime(timerSeconds)}
                </div>
                <p className="text-xs font-medium text-white/40 ">{t('pomodoro_session')}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className={`flex-1 py-3 rounded-xl font-bold text-[10px] transition-all ${
                    isTimerRunning
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-accent text-white hover:bg-white hover:text-[#0D1117]'
                  }`}
                >
                  {isTimerRunning ? t('pause') : t('dashboard_start')}
                </button>
                <button
                  onClick={() => setIsPlanSessionOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold text-white hover:bg-white/20 transition-all"
                >
                  <Brain className="w-3 h-3" />
                  Plan
                </button>
                <button
                  onClick={() => { setIsTimerRunning(false); setTimerSeconds(defaultDuration * 60); }}
                  className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-white/60" />
                </button>
              </div>
            </section>

            {/* Calendar Widget */}
            <CalendarWidget />

            {/* Learning Stats */}
            <section className="bg-white rounded-2xl p-6 border border-slate-200 dark:bg-paper dark:border-white/8">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-slate-500 dark:text-ink-muted">{t('modules')}</p>
                  <span className="ls-section-title">{activeModules.length}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-slate-500 dark:text-ink-muted">{t('avg_completion')}</p>
                  <span className="ls-section-title">
                    {Math.round(activeModules.reduce((acc, m) => acc + m.progress, 0) / (activeModules.length || 1))}%
                  </span>
                </div>
              </div>
            </section>

            {/* Reminders & Exams */}
            <section className="space-y-6">
              {/* Upcoming Exams & Controles */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-blue-700 flex items-center gap-2 dark:text-accent">
                    <AlertCircle className="w-3 h-3" />
                    {t('upcoming_exams')}
                  </h3>
                  <button 
                    onClick={() => setIsReminderModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {upcomingExams.map((reminder) => (
                      <div key={reminder.id} className="flex items-center gap-3 p-3 bg-accent/5 border border-accent/10 rounded-xl">
                        <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
                          <Brain className="w-4 h-4 text-accent" />
                        </div>
                        <div className="flex-grow min-w-0">
                          <h4 className="text-xs font-bold text-slate-950 truncate dark:text-ink">{reminder.title}</h4>
                          <p className="text-[9px] font-bold text-accent ">
                            {reminder.type === 'exam' ? t('exam') : t('controle')} • {reminder.dueDate ? format(new Date(reminder.dueDate), 'MMM dd') : 'No date'}
                          </p>
                        </div>
                        <button 
                          onClick={() => toggleReminder(reminder.id)}
                          className="w-6 h-6 rounded-full border-accent/20 flex items-center justify-center hover:bg-accent hover:text-white transition-all"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ))}
                  {upcomingExams.length === 0 && (
                    <p className="text-[10px] text-slate-500 italic px-2 dark:text-ink-muted">{t('no_pending_reminders')}</p>
                  )}
                </div>
              </div>

              {/* General Reminders */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="ls-micro-label">{t('reminders')}</h3>
                  <button className="text-[9px] font-bold text-accent ">{t('view_all')}</button>
                </div>
                <div className="space-y-2">
                  {generalReminders.map((reminder) => (
                      <div key={reminder.id} onClick={() => toggleReminder(reminder.id)} className="flex items-center gap-3 p-3 ls-card cursor-pointer hover:border-accent/20 transition-all">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${reminder.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 dark:border-white/15'}`}>
                          {reminder.completed && <Check size={10} />}
                        </div>
                        <div className="flex-grow min-w-0">
                          <span className={`text-xs font-medium block truncate ${reminder.completed ? 'text-slate-500 line-through dark:text-ink-muted' : 'text-slate-950 dark:text-ink'}`}>{reminder.title}</span>
                          {reminder.dueDate && (
                            <span className="text-[8px] font-bold text-slate-500 dark:text-ink-muted">
                              {format(new Date(reminder.dueDate), 'MMM dd')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </section>

            {/* Schedule */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-950 dark:text-ink">{t('agenda')}</h3>
                <CalendarIcon className="w-4 h-4 text-slate-500 dark:text-ink-muted" />
              </div>
              <div className="space-y-4">
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.map((event) => {
                      const d = new Date(event.date);
                      return (
                        <div key={event.id} className="flex gap-4">
                          <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-50 rounded-xl shrink-0 dark:bg-surface-low">
                            <span className="text-[9px] font-medium text-slate-500 uppercase dark:text-ink-muted">{format(d, 'MMM')}</span>
                            <span className="text-lg font-bold text-slate-950 leading-none dark:text-ink">{format(d, 'd')}</span>
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-slate-950 leading-tight dark:text-ink">{event.title}</h4>
                            {event.time && (
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium uppercase tracking-wider dark:text-ink-muted">
                                <Clock className="w-3 h-3" />
                                {event.time}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <p className="ls-micro-label italic">{t('no_upcoming_events')}</p>
                )}
              </div>
            </section>

            {/* Preferences - Subtle */}
            <div className="pt-10 border-t border-slate-200 dark:border-white/8">
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 ls-micro-label hover:text-slate-950 transition-colors dark:hover:text-ink"
              >
                <Settings className="w-3.5 h-3.5" />
                {t('preferences')}
              </button>
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
                {uniqueSubjects.map((subject, idx) => (
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
          window.location.reload();
        }}
      />
    </Layout>
  );
};
