import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Timer, 
  BookOpen, 
  Calendar as CalendarIcon, 
  RefreshCw, 
  Settings, 
  MoreHorizontal, 
  ChevronRight, 
  Check, 
  Plus,
  Search,
  Bell,
  Clock,
  LayoutDashboard,
  Archive,
  User,
  ArrowRight,
  Brain,
  Sparkles,
  Zap,
  Loader2,
  ChevronLeft,
  AlertCircle,
  Calendar,
  Database,
  Cloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  addMonths, 
  subMonths 
} from 'date-fns';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { TagsManager } from '../components/TagsManager';
import { SEO } from '../components/SEO';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { supabase, checkSupabaseConnection } from '../db/supabase';
import { generateLessonSuggestions, LessonSuggestion } from '../services/geminiService';
import { lessonService } from '../services/lessonService';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { ConnectionStatusModal } from '../components/ConnectionStatusModal';
import { OnboardingModal } from '../components/OnboardingModal';

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
  const [currentMonth, setCurrentMonth] = useState(new Date());
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

  const activeModules = useMemo(() => allModules.filter(m => m.selected), [allModules]);
  const reminders = useLiveQuery(() => db.tasks.toArray()) || [];
  const schedule = useLiveQuery(() => db.schedule.toArray()) || [];
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];
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
    setIsFetchingGallery(true);
    setSuggestions([]);
    
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
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-ink leading-tight">{t('dashboard')}</h1>
              <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{t('academic_repository')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/pricing')}
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-bold uppercase tracking-widest transition-all ${
                isPro 
                  ? 'bg-accent/10 border-accent/20 text-accent shadow-sm' 
                  : 'bg-paper border-ink/10 text-muted hover:border-accent/30'
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
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${dbConnected ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-error/10 border-error/20 text-error'} text-[9px] font-bold uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50`}
                >
                  {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3" />}
                  {isSyncing ? 'Syncing...' : 'Sync to Cloud'}
                </button>
                <button 
                  onClick={() => setIsStatusModalOpen(true)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${dbConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-error/10 border-error/20 text-error'} text-[9px] font-bold uppercase tracking-widest hover:scale-105 transition-all`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${dbConnected ? 'bg-emerald-500' : 'bg-error'} animate-pulse`} />
                  {dbConnected ? 'Cloud Connected' : 'Local Only'}
                </button>
                <button 
                  onClick={async () => {
                    await refreshDbConnection();
                  }}
                  className="p-1.5 hover:bg-ink/5 rounded-full text-muted transition-all"
                  title="Refresh Connection"
                >
                  <RefreshCw className={`w-3 h-3 ${dbConnected === null ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
            <button 
              onClick={() => setShowAuditModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-paper border border-ink/5 rounded-xl text-[10px] font-bold text-muted uppercase tracking-widest hover:border-accent/30 hover:text-accent transition-all"
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
              className="flex items-center gap-2 px-4 py-2 bg-paper border border-ink/5 rounded-xl text-[10px] font-bold text-error/60 uppercase tracking-widest hover:bg-error/5 hover:text-error transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('reset')}
            </button>
          </div>
        </div>

        {/* Hero Section - Minimal & Clean */}
        <section className="relative overflow-hidden rounded-3xl bg-accent-soft text-ink p-8 mx-4">
          <div className="relative z-10 max-w-lg space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
                  {t('personalized_for', { grade: selectedGrade })}
                </p>
                <div className="w-1 h-1 rounded-full bg-ink/20" />
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink/40">
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
                className="px-6 py-3 bg-accent text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-ink hover:text-paper transition-all"
              >
                {t('dashboard_explore')}
              </button>
              <button 
                onClick={() => navigate('/blueprints')}
                className="px-6 py-3 bg-ink/5 border border-ink/10 text-ink rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-ink/10 transition-all"
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
            {lastLesson && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/lesson/${lastLesson.id}`)}
                className="bg-accent/5 border border-accent/20 rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:bg-accent/10 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-accent text-white rounded-xl flex items-center justify-center">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-accent uppercase tracking-widest">Continue Learning</p>
                    <h3 className="text-sm font-bold text-ink">{lastLesson.title}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-accent">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Resume</span>
                  <ChevronRight size={18} />
                </div>
              </motion.div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-ink">{t('active_classrooms')}</h2>
                <p className="text-sm text-muted">{t('active_paths_desc')}</p>
              </div>
              <button 
                onClick={() => navigate('/modules')}
                className="text-xs font-bold text-accent uppercase tracking-widest hover:underline flex items-center gap-2"
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
                    className="group relative bg-surface-low border border-ink/5 rounded-2xl hover:border-accent/20 transition-all cursor-pointer p-6 space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-1 bg-background text-muted text-[10px] font-bold uppercase tracking-widest rounded">
                        {module.code}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${module.selected ? 'bg-emerald-500' : 'bg-ink/20'}`} />
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">{module.selected ? t('active') : t('inactive')}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-ink leading-tight group-hover:text-accent transition-colors">
                        {module.name}
                      </h3>
                      <p className="text-sm text-muted line-clamp-2 leading-relaxed">
                        {module.description}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted">
                        <span>{t('progress')}</span>
                        <span>{module.progress}%</span>
                      </div>
                      <div className="h-[4.5px] bg-background rounded-full overflow-hidden">
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
                <div className="col-span-full py-20 bg-surface-low/30 border border-dashed border-ink/10 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 bg-paper rounded-full flex items-center justify-center shadow-sm">
                    <Plus className="w-6 h-6 text-muted" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-ink">{t('onboarding_first_classroom')}</p>
                    <p className="text-xs text-muted">{t('motivation_start_or_stuck')}</p>
                  </div>
                  <button 
                    onClick={() => navigate('/modules')}
                    className="px-6 py-3 bg-ink text-paper rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-accent transition-all"
                  >
                    {t('onboarding_start_building')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Focus & Agenda */}
          <div className="lg:col-span-4 space-y-8">
            {/* Focus Timer Card */}
            <section className="bg-[#0D1117] text-white rounded-2xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t('deep_focus')}</h3>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isTimerRunning ? 'bg-accent animate-pulse' : 'bg-white/20'}`} />
                  <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
                    {isTimerRunning ? t('active') : t('idle')}
                  </span>
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-5xl font-bold tracking-tighter mb-1">
                  {formatTime(timerSeconds)}
                </div>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{t('pomodoro_session')}</p>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className={`flex-grow py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${
                    isTimerRunning 
                      ? 'bg-white/10 text-white hover:bg-white/20' 
                      : 'bg-accent text-white hover:bg-white hover:text-[#0D1117]'
                  }`}
                >
                  {isTimerRunning ? t('pause') : t('dashboard_start')}
                </button>
                <button 
                  onClick={() => {
                    setIsTimerRunning(false);
                    setTimerSeconds(defaultDuration * 60);
                  }}
                  className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-white/60" />
                </button>
              </div>
            </section>

            {/* Calendar Widget */}
            <section className="bg-surface-mid border border-ink/5 rounded-[10px] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-muted uppercase tracking-widest">{t('calendar')}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-background rounded-lg"><ChevronLeft size={14} /></button>
                  <span className="text-[10px] font-bold text-ink">{format(currentMonth, 'MMM yyyy')}</span>
                  <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-background rounded-lg"><ChevronRight size={14} /></button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <div key={index} className="text-[9px] font-bold text-muted/40 text-center py-1">{day}</div>
                ))}
                {eachDayOfInterval({
                  start: startOfWeek(startOfMonth(currentMonth)),
                  end: endOfWeek(endOfMonth(currentMonth))
                }).map((day, i) => {
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div key={i} className={`aspect-square flex items-center justify-center text-[10px] font-medium rounded-lg ${!isCurrentMonth ? 'text-muted/20' : 'text-ink'} ${isToday ? 'bg-accent text-white font-bold' : 'hover:bg-background'}`}>
                      {day.getDate()}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Learning Stats */}
            <section className="bg-background rounded-2xl p-6 border border-ink/5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-muted uppercase tracking-widest">{t('modules')}</p>
                  <span className="text-2xl font-bold text-ink">{activeModules.length}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-bold text-muted uppercase tracking-widest">{t('avg_completion')}</p>
                  <span className="text-2xl font-bold text-ink">
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
                  <h3 className="text-[10px] font-bold text-accent uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" />
                    {t('upcoming_exams')}
                  </h3>
                  <button 
                    onClick={() => setIsReminderModalOpen(true)}
                    className="p-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-all"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  {reminders
                    .filter(r => (r.type === 'exam' || r.type === 'controle') && !r.completed)
                    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
                    .slice(0, 3)
                    .map((reminder) => (
                      <div key={reminder.id} className="flex items-center gap-3 p-3 bg-accent/5 border border-accent/10 rounded-xl">
                        <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center shrink-0">
                          <Brain className="w-4 h-4 text-accent" />
                        </div>
                        <div className="flex-grow min-w-0">
                          <h4 className="text-xs font-bold text-ink truncate">{reminder.title}</h4>
                          <p className="text-[9px] font-bold text-accent uppercase tracking-widest">
                            {reminder.type === 'exam' ? t('exam') : t('controle')} • {reminder.dueDate ? format(new Date(reminder.dueDate), 'MMM dd') : 'No date'}
                          </p>
                        </div>
                        <button 
                          onClick={() => toggleReminder(reminder.id)}
                          className="w-6 h-6 rounded-full border border-accent/20 flex items-center justify-center hover:bg-accent hover:text-white transition-all"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ))}
                  {reminders.filter(r => (r.type === 'exam' || r.type === 'controle') && !r.completed).length === 0 && (
                    <p className="text-[10px] text-muted italic px-2">{t('no_pending_reminders')}</p>
                  )}
                </div>
              </div>

              {/* General Reminders */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-muted uppercase tracking-widest">{t('reminders')}</h3>
                  <button className="text-[9px] font-bold text-accent uppercase tracking-widest">{t('view_all')}</button>
                </div>
                <div className="space-y-2">
                  {reminders
                    .filter(r => r.type !== 'exam' && r.type !== 'controle' && !r.completed)
                    .slice(0, 3)
                    .map((reminder) => (
                      <div key={reminder.id} onClick={() => toggleReminder(reminder.id)} className="flex items-center gap-3 p-3 bg-paper border border-ink/5 rounded-xl cursor-pointer hover:border-accent/20 transition-all">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${reminder.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-ink/10'}`}>
                          {reminder.completed && <Check size={10} />}
                        </div>
                        <div className="flex-grow min-w-0">
                          <span className={`text-xs font-medium block truncate ${reminder.completed ? 'text-muted line-through' : 'text-ink'}`}>{reminder.title}</span>
                          {reminder.dueDate && (
                            <span className="text-[8px] font-bold text-muted uppercase tracking-widest">
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
                <h3 className="text-sm font-bold text-ink uppercase tracking-widest">{t('agenda')}</h3>
                <CalendarIcon className="w-4 h-4 text-muted" />
              </div>
              <div className="space-y-4">
                {schedule.length > 0 ? (
                  schedule.slice(0, 3).map((event) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center justify-center w-12 h-12 bg-surface-low rounded-xl shrink-0">
                        <span className="text-[10px] font-bold text-muted uppercase">{event.month.slice(0, 3)}</span>
                        <span className="text-lg font-bold text-ink leading-none">{event.date}</span>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-ink leading-tight">{event.title}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-muted font-medium uppercase tracking-wider">
                          <Clock className="w-3 h-3" />
                          {event.time}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted italic">{t('no_upcoming_events')}</p>
                )}
              </div>
            </section>

            {/* Preferences - Subtle */}
            <div className="pt-10 border-t border-ink/5">
              <button 
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 text-[10px] font-bold text-muted uppercase tracking-widest hover:text-ink transition-colors"
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
          className="fixed bottom-8 right-8 w-16 h-16 bg-accent text-white rounded-full shadow-2xl shadow-accent/40 flex items-center justify-center z-50 group overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <Plus className="w-8 h-8 relative z-10" />
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
            <p className="text-sm text-muted leading-relaxed">
              {t('audit_description', { grade: selectedGrade, country: selectedCountry })}
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted">{t('audit_parameters')}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-surface-low rounded-xl border border-ink/5">
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">{t('grade')}</p>
                <p className="text-sm font-bold text-ink">{selectedGrade}</p>
              </div>
              <div className="p-4 bg-surface-low rounded-xl border border-ink/5">
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">{t('region')}</p>
                <p className="text-sm font-bold text-ink">{selectedCountry}</p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => {
              setShowAuditModal(false);
              // In a real app, this would trigger a background audit process
              alert(t('audit_started'));
            }}
            className="w-full py-4 bg-ink text-paper rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-accent transition-all shadow-xl shadow-ink/20"
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
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest">{t('title')}</label>
              <input 
                type="text"
                list="session-titles"
                value={newReminder.title}
                onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                placeholder={t('e_g_math_exam')}
                className="w-full px-4 py-3 bg-surface-low border border-ink/5 rounded-xl text-sm focus:outline-none focus:border-accent/30 transition-all"
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
                <label className="text-[10px] font-bold text-muted uppercase tracking-widest">{t('due_date')}</label>
                <input 
                  type="date"
                  value={newReminder.dueDate}
                  onChange={(e) => setNewReminder({ ...newReminder, dueDate: e.target.value })}
                  className="w-full px-4 py-3 bg-surface-low border border-ink/5 rounded-xl text-sm focus:outline-none focus:border-accent/30 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted uppercase tracking-widest">{t('type')}</label>
                <select 
                  value={newReminder.type}
                  onChange={(e) => setNewReminder({ ...newReminder, type: e.target.value as any })}
                  className="w-full px-4 py-3 bg-surface-low border border-ink/5 rounded-xl text-sm focus:outline-none focus:border-accent/30 transition-all appearance-none"
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
            className="w-full py-4 bg-accent text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ink hover:text-paper transition-all shadow-xl shadow-accent/20"
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
              <span className="text-[10px] font-bold uppercase tracking-widest">{t('suggested_units')}</span>
            </div>
            <p className="text-sm text-muted leading-relaxed">
              {t('suggested_units_description', { grade: selectedGrade, country: selectedCountry })}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {isFetchingGallery ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-xs text-muted font-medium animate-pulse">{t('consulting_resources')}</p>
              </div>
            ) : (
              suggestions.map((suggestion, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleCurateFromGallery(suggestion.title)}
                  className="p-4 bg-surface-low border border-ink/5 rounded-xl hover:border-accent/30 hover:bg-paper hover:shadow-lg transition-all cursor-pointer group flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-ink group-hover:text-accent transition-colors">{suggestion.title}</h4>
                    <p className="text-[11px] text-muted line-clamp-1">{suggestion.description}</p>
                  </div>
                  <Plus size={16} className="text-muted group-hover:text-accent transition-colors" />
                </motion.div>
              ))
            )}
          </div>
          <div 
            onClick={() => navigate('/modules')}
            className="group relative bg-surface-low border border-dashed border-ink/20 rounded-2xl hover:border-accent/50 transition-all cursor-pointer p-6 flex flex-col items-center justify-center space-y-4"
          >
            <div className="w-12 h-12 rounded-full bg-accent/5 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all">
              <Plus size={24} />
            </div>
            <span className="text-sm font-bold text-ink uppercase tracking-widest">{t('actions_create_classroom')}</span>
          </div>

          {!isFetchingGallery && (
            <button 
              onClick={() => navigate(`/classroom/${selectedModule?.id}`)}
              className="w-full py-4 bg-ink text-paper rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-accent transition-all flex items-center justify-center gap-2"
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
            className="fixed inset-0 z-[100] bg-[#0D1117]/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
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
                <span className="text-[10px] font-bold uppercase tracking-widest">{t('synthesizing_blocks')}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ConnectionStatusModal 
        isOpen={isStatusModalOpen} 
        onClose={() => setIsStatusModalOpen(false)} 
        onRefresh={refreshDbConnection}
      />
      
      <OnboardingModal 
        isOpen={isOnboardingOpen}
        onComplete={() => {
          setIsOnboardingOpen(false);
          // Optional: reload to apply new settings immediately
          window.location.reload();
        }}
      />
    </Layout>
  );
};
