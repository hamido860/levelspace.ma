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

  React.useEffect(() => {
    const hasCompleted = localStorage.getItem('has_completed_onboarding');
    if (hasCompleted !== 'true') {
      setIsOnboardingOpen(true);
    }
  }, []);

  const allModules = useLiveQuery(() => db.modules.toArray()) || [];
  const allLessons = useLiveQuery(() => db.lessons.toArray()) || [];

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
  const reminders = useLiveQuery(() => db.tasks.toArray()) || [];
  const schedule = useLiveQuery(() => db.schedule.toArray()) || [];
  const dbSettings = useLiveQuery(() => db.settings.toArray()) || [];

  const activeReminders = useMemo(() => {
    return reminders
      .filter(r => !r.completed)
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  }, [reminders]);

  const upcomingEvents = useMemo(() => {
    return schedule
      .filter(e => e.date?.includes('-'))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [schedule]);
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

        {/* Simple Welcome Header */}
        <div className="px-4 pt-6 pb-2">
          <h1 className="text-2xl font-bold text-slate-950 dark:text-ink">
            {t('welcome_back', { name: profile?.first_name || 'Student' }) || `Welcome back${profile?.first_name ? `, ${profile.first_name}` : ''}`}
          </h1>
          <p className="text-sm text-slate-500 mt-1 dark:text-ink-muted">
            {t('dashboard_continue') || "Here's what's happening in your classes today."}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-4">
          
          {/* Main Content Column */}
          <div className="lg:col-span-8 space-y-10">
            
            {/* Course Modules */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-950 dark:text-ink">{t('course_modules') || 'Course Modules'}</h2>
                <button onClick={() => navigate('/modules')} className="text-sm font-bold text-accent hover:underline">
                  {t('view_all') || 'View All'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allModules.length > 0 ? (
                  allModules.map((module, i) => (
                    <motion.div
                      key={module.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => navigate(`/classroom/${module.id}`)}
                      className="bg-white border border-slate-200 rounded-3xl overflow-hidden flex flex-col group cursor-pointer hover:border-accent/30 hover:shadow-lg transition-all dark:bg-paper dark:border-white/8 shadow-sm"
                    >
                      {/* Top Redesigned Teal Header Bar */}
                      <div className="bg-[#007A87] px-5 py-3.5 flex items-center justify-between text-white dark:bg-accent shrink-0">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-5 h-5 shrink-0 text-white" />
                          <h3 className="text-sm font-bold leading-tight truncate text-white max-w-[160px]">{module.name}</h3>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {module.category && module.category !== module.name && (
                            <span className="bg-white/15 text-white text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm truncate max-w-[90px]">{module.category}</span>
                          )}
                          {module.code && module.code !== module.name && (
                            <span className="bg-white/15 text-white text-[9px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm truncate max-w-[60px]">{module.code}</span>
                          )}
                        </div>
                      </div>

                      {/* Horizontal Dynamic Illustration Banner */}
                      <div className="h-24 w-full overflow-hidden relative border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-surface-low shrink-0">
                        <img 
                          src={getLessonIllustration(module.name, module.category)}
                          alt={module.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      </div>

                      {/* Card Body */}
                      <div className="p-5 flex-1 flex flex-col space-y-4">
                        {/* Metrics grid */}
                        <div className="grid grid-cols-2 gap-4 text-sm border-b border-slate-100 pb-4 dark:border-white/6 items-center">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-slate-400 dark:text-ink-muted" />
                            <span className="font-bold text-slate-800 dark:text-ink">{lessonCountByModuleId[module.id] ?? 0} Lessons</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold">
                              <span className="text-slate-400 dark:text-ink-muted">Progress</span>
                              <span className="text-slate-800 dark:text-ink">{module.progress}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-surface-mid">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${module.progress}%` }} />
                            </div>
                          </div>
                        </div>

                        {/* Last activity */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-ink-muted">
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>
                            Last Active: {lastActivityByModuleId[module.id] ? relativeTime(lastActivityByModuleId[module.id]) : 'No activity yet'}
                          </span>
                        </div>

                        {/* Footer: actions */}
                        <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-white/6">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/classroom/${module.id}`); }}
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white transition-colors shadow-sm"
                            >
                              <Play className="w-3 h-3 fill-current text-white" />
                              Start Lesson
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleModuleClick(module.id, module.name); }}
                              className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors dark:border-white/10 dark:bg-paper dark:text-ink-secondary dark:hover:bg-surface-low"
                            >
                              View Plan
                            </button>
                          </div>

                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            module.selected ? 'text-accent' : 'text-emerald-700 dark:text-emerald-400'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${module.selected ? 'bg-accent' : 'bg-emerald-500 animate-pulse'}`} />
                            {module.selected ? 'Active' : 'Available'}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full py-12 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 dark:bg-paper dark:border-white/8">
                    <BookOpen className="w-8 h-8 text-slate-300 dark:text-ink-muted/50" />
                    <p className="text-sm font-bold text-slate-950 dark:text-ink">{t('no_modules_yet') || 'No modules yet'}</p>
                    <button onClick={() => navigate('/modules')} className="text-xs font-bold text-accent hover:underline">
                      {t('dashboard_explore') || 'Explore Curriculum'}
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Upcoming Assignments (Moved from Sidebar Reminders & Exams) */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-950 dark:text-ink">{t('upcoming_assignments') || 'Upcoming Assignments'}</h2>
                <button onClick={() => setIsReminderModalOpen(true)} className="text-sm font-bold text-accent hover:underline flex items-center gap-1">
                  <Plus size={14} /> {t('add') || 'Add'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeReminders.length > 0 ? (
                  activeReminders
                    .slice(0, 4)
                    .map((reminder, i) => (
                      <motion.div 
                        key={reminder.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between group dark:bg-paper dark:border-white/8"
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
                  <div className="col-span-full py-8 text-center bg-white border border-slate-200 rounded-2xl dark:bg-paper dark:border-white/8">
                    <p className="text-sm font-medium text-slate-500 dark:text-ink-muted">{t('no_pending_reminders') || 'No upcoming assignments. You are all caught up!'}</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Sidebar Column */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Focus Timer (Subtle Widget) */}
            <section className="bg-slate-950 text-white rounded-2xl p-5 relative overflow-hidden group dark:bg-white dark:text-slate-950">
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider dark:text-slate-500">{t('deep_focus') || 'Deep Focus'}</h3>
                  <div className="text-3xl font-bold tracking-tight mt-1 mb-3">
                    {formatTime(timerSeconds)}
                  </div>
                </div>
                <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center ${isTimerRunning ? 'border-accent text-accent animate-pulse' : 'border-slate-800 text-slate-600 dark:border-slate-200 dark:text-slate-400'}`}>
                  <Timer size={20} />
                </div>
              </div>
              <div className="relative z-10 flex gap-2">
                <button
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isTimerRunning
                      ? 'bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-950'
                      : 'bg-accent text-white hover:bg-accent/90'
                  }`}
                >
                  {isTimerRunning ? (t('pause') || 'Pause') : (t('dashboard_start') || 'Start Timer')}
                </button>
                <button
                  onClick={() => { setIsTimerRunning(false); setTimerSeconds(defaultDuration * 60); }}
                  className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-700 transition-all dark:bg-slate-100 dark:text-slate-600"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </section>
            {/* Support Zone / MyLevel */}
            <section className="bg-slate-950 text-white rounded-2xl p-5 relative overflow-hidden group dark:bg-white dark:text-slate-950 mb-8">
              <div className="relative z-10 flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider dark:text-slate-500">Support Zone / MyLevel</h3>
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-accent/30 text-accent flex items-center justify-center bg-accent/10">
                  <Activity size={18} />
                </div>
              </div>
              <div className="relative z-10 space-y-4">
                <p className="text-sm font-medium text-slate-300 dark:text-slate-600 leading-relaxed">
                  Check your real level, discover your gaps, and get a personal roadmap.
                </p>
                <button
                  onClick={() => setIsSupportModalOpen(true)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold transition-all bg-accent text-white hover:bg-accent/90"
                >
                  Start MyLevel Check
                </button>
              </div>
            </section>

            {/* Upcoming Events / Agenda */}
            <section className="bg-white border border-slate-200 rounded-2xl p-5 dark:bg-paper dark:border-white/8">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-slate-950 dark:text-ink">{t('upcoming_events') || 'Upcoming Events'}</h3>
                <CalendarIcon size={16} className="text-slate-400" />
              </div>
              <div className="space-y-4">
                {upcomingEvents.length > 0 ? (
                  upcomingEvents
                    .slice(0, 4)
                    .map((event) => {
                      const d = new Date(event.date);
                      return (
                        <div key={event.id} className="flex gap-4 items-start">
                          <div className="flex flex-col items-center justify-center w-11 h-11 bg-slate-50 text-slate-500 rounded-xl shrink-0 dark:bg-surface-low dark:text-ink-muted">
                            <span className="text-[10px] font-bold uppercase">{format(d, 'MMM')}</span>
                            <span className="text-sm font-bold leading-none text-slate-950 dark:text-ink">{format(d, 'd')}</span>
                          </div>
                          <div className="space-y-0.5 pt-0.5">
                            <h4 className="text-sm font-bold text-slate-950 leading-tight dark:text-ink">{event.title}</h4>
                            {event.time && (
                              <p className="text-xs font-medium text-slate-500 flex items-center gap-1 dark:text-ink-muted">
                                <Clock size={12} /> {event.time}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <p className="text-sm text-slate-500 italic dark:text-ink-muted">{t('no_upcoming_events') || 'No upcoming events scheduled.'}</p>
                )}
              </div>
            </section>

            {/* Learning Stats (Clean list) */}
            <section className="bg-white border border-slate-200 rounded-2xl p-5 dark:bg-paper dark:border-white/8">
               <h3 className="text-base font-bold text-slate-950 mb-4 dark:text-ink">{t('learning_stats') || 'Stats'}</h3>
               <div className="space-y-3">
                 <div className="flex items-center justify-between text-sm">
                   <span className="font-medium text-slate-500 dark:text-ink-muted">{t('active_modules') || 'Active Modules'}</span>
                   <span className="font-bold text-slate-950 dark:text-ink">{activeModules.length}</span>
                 </div>
                 <div className="flex items-center justify-between text-sm">
                   <span className="font-medium text-slate-500 dark:text-ink-muted">{t('avg_completion') || 'Avg Completion'}</span>
                   <span className="font-bold text-slate-950 dark:text-ink">
                     {Math.round(activeModules.reduce((acc, m) => acc + m.progress, 0) / (activeModules.length || 1))}%
                   </span>
                 </div>
               </div>
            </section>

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
          window.location.reload();
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
