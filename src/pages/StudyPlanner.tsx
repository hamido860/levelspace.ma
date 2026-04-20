import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { 
  Calendar, 
  Plus, 
  Target, 
  Clock, 
  BookOpen, 
  CheckCircle2, 
  Circle, 
  ChevronLeft,
  Trash2,
  AlertCircle,
  ArrowRight,
  Zap,
  X
} from 'lucide-react';
import { Modal } from '../components/Modal';

interface StudySession {
  id: string;
  subject: string;
  date: string;
  startTime: string;
  duration: number; // in minutes
  completed: boolean;
}

interface StudyGoal {
  id: string;
  title: string;
  deadline: string;
  progress: number; // 0 to 100
}

export const StudyPlanner: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [goals, setGoals] = useState<StudyGoal[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalTab, setAddModalTab] = useState<'goal' | 'session'>('session');

  // Form states
  const [newSession, setNewSession] = useState({ subject: '', date: '', startTime: '', duration: 60, session: '' });
  const [newGoal, setNewGoal] = useState({ title: '', deadline: '' });

  // Load from localStorage
  useEffect(() => {
    const savedSessions = localStorage.getItem('study_sessions');
    const savedGoals = localStorage.getItem('study_goals');
    const defaultDuration = localStorage.getItem('default_session_duration');
    const currentSession = localStorage.getItem('current_session');

    if (defaultDuration) {
      setNewSession(prev => ({ ...prev, duration: Number(defaultDuration) }));
    }
    
    if (currentSession) {
      setNewSession(prev => ({ ...prev, session: currentSession }));
    }

    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed)) setSessions(parsed);
      } catch (e) {
        console.error("Error parsing sessions", e);
      }
    }
    if (savedGoals) {
      try {
        const parsed = JSON.parse(savedGoals);
        if (Array.isArray(parsed)) setGoals(parsed);
      } catch (e) {
        console.error("Error parsing goals", e);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('study_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('study_goals', JSON.stringify(goals));
  }, [goals]);

  const addSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSession.subject || !newSession.date || !newSession.startTime) return;
    
    const session: StudySession = {
      id: Math.random().toString(36).substr(2, 9),
      ...newSession,
      completed: false
    };
    
    setSessions([...sessions, session].sort((a, b) => 
      new Date(`${a.date} ${a.startTime}`).getTime() - new Date(`${b.date} ${b.startTime}`).getTime()
    ));
    
    const defaultDuration = localStorage.getItem('default_session_duration') || '60';
    const currentSession = localStorage.getItem('current_session') || '';
    setNewSession({ subject: '', date: '', startTime: '', duration: Number(defaultDuration), session: currentSession });
    setShowAddModal(false);
  };

  const addGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.title || !newGoal.deadline) return;
    
    const goal: StudyGoal = {
      id: Math.random().toString(36).substr(2, 9),
      ...newGoal,
      progress: 0
    };
    
    setGoals([...goals, goal]);
    setNewGoal({ title: '', deadline: '' });
    setShowAddModal(false);
  };

  const toggleSession = (id: string) => {
    setSessions(sessions.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const deleteSession = (id: string) => {
    setSessions(sessions.filter(s => s.id !== id));
  };

  const deleteGoal = (id: string) => {
    setGoals(goals.filter(g => g.id !== id));
  };

  const updateGoalProgress = (id: string, progress: number) => {
    setGoals(goals.map(g => g.id === id ? { ...g, progress: Math.min(100, Math.max(0, progress)) } : g));
  };

  return (
    <Layout>
      <SEO title="Study Planner" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-ink font-display tracking-tight">Study Planner</h1>
          <p className="text-muted text-sm mt-1">Manage your study goals and sessions.</p>
        </div>
        <button 
          onClick={() => { setAddModalTab('session'); setShowAddModal(true); }}
          className="px-6 py-3 bg-ink text-paper rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-accent transition-all flex items-center gap-2 shadow-lg shadow-ink/10"
        >
          <Target size={16} /> Plan Study Session
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Goals */}
        <section className="lg:col-span-4 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl md:text-2xl font-bold text-ink font-sans tracking-tight">Study Goals</h2>
            </div>
            
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {goals.length > 0 ? (
                  goals.map((goal, i) => (
                    <motion.div 
                      key={goal.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.1 }}
                      className="group p-4 bg-surface-low border border-ink/5 rounded-2xl hover:border-accent/20 transition-all duration-500 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-3 relative z-10">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 bg-accent/10 rounded-lg flex items-center justify-center text-accent shrink-0">
                            <Target size={14} />
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <h3 className="text-xs font-bold text-ink truncate max-w-[120px]">{goal.title}</h3>
                            <div className="flex items-center gap-1.5">
                              <div className="w-1 h-1 rounded-full bg-accent/40" />
                              <p className="text-[7px] font-mono uppercase tracking-widest text-muted">
                                T-MINUS {Math.ceil((new Date(goal.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} DAYS
                              </p>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteGoal(goal.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-muted/20 hover:text-red-500 hover:bg-red-500/5 rounded-md transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <div className="space-y-2 relative z-10">
                        <div className="flex items-center justify-between">
                          <div className="h-1 flex-grow bg-ink/5 rounded-full overflow-hidden mr-3">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${goal.progress}%` }}
                              className="h-full bg-accent shadow-[0_0_8px_rgba(var(--accent-rgb),0.3)]"
                            />
                          </div>
                          <span className="text-[9px] font-mono font-black text-accent">{goal.progress}%</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {[0, 25, 50, 75, 100].map((val) => (
                            <button
                              key={val}
                              onClick={() => updateGoalProgress(goal.id, val)}
                              className={`flex-1 py-1 text-[7px] font-mono font-bold rounded-md transition-all border ${
                                goal.progress === val 
                                  ? 'bg-accent border-accent text-paper shadow-sm' 
                                  : 'bg-paper/50 border-ink/5 text-muted hover:border-accent/20 hover:text-accent'
                              }`}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Subtle background ID */}
                      <div className="absolute -bottom-1 -right-1 text-[40px] font-black text-ink/[0.02] pointer-events-none select-none font-mono">
                        0{i + 1}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-12 text-center border-2 border-dashed border-ink/5 rounded-3xl space-y-3"
                  >
                    <Target className="w-6 h-6 text-muted/20 mx-auto" />
                    <p className="text-xs font-bold uppercase tracking-widest text-muted/40">No goals defined</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Productivity Stats - Re-imagined as a Technical Widget */}
          <div className="p-6 bg-surface-low border border-ink/10 rounded-3xl space-y-6 relative overflow-hidden shadow-sm group hover:shadow-md transition-all duration-500">
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-ink/40">System.Productivity_Index</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-success" />
                  <span className="text-[8px] font-mono text-success/60 uppercase tracking-tighter">Live</span>
                </div>
                <span className="text-[9px] font-mono text-ink/20 tracking-tighter">v2.4.0-STABLE</span>
              </div>
            </div>
            
            <div className="flex items-end justify-between relative z-10">
              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-6xl font-black tracking-tighter text-ink leading-none">84</span>
                  <span className="text-xl font-bold text-accent">%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-1.5 py-0.5 bg-success-soft text-success text-[8px] font-bold rounded uppercase tracking-tighter border border-success/10">
                    +12% Trend
                  </div>
                  <span className="text-[9px] font-medium text-ink/40 italic">vs last week</span>
                </div>
              </div>
              
              {/* Mini Dot Matrix Chart representing activity */}
              <div className="flex flex-col items-end gap-2">
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 21 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                        i > 14 ? 'bg-accent shadow-[0_0_5px_rgba(var(--accent-rgb),0.4)]' : i > 7 ? 'bg-accent/40' : 'bg-ink/5'
                      }`} 
                    />
                  ))}
                </div>
                <span className="text-[8px] font-mono text-ink/30 uppercase tracking-widest">Activity_Log.21d</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 relative z-10 pt-6 border-t border-ink/10">
              <div className="space-y-2 p-3 bg-paper/30 rounded-xl border border-ink/5">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-ink/30" />
                  <span className="text-[9px] font-mono uppercase tracking-widest text-ink/40">Active_Time</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-ink">12.4</span>
                  <span className="text-xs font-medium text-ink/40">hrs</span>
                </div>
              </div>
              <div className="space-y-2 p-3 bg-paper/30 rounded-xl border border-ink/5">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-ink/30" />
                  <span className="text-[9px] font-mono uppercase tracking-widest text-ink/40">Cycles_Done</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-ink">{sessions.filter(s => s.completed).length}</span>
                  <span className="text-xs font-medium text-ink/40">units</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-2 flex items-center justify-between">
              <div className="flex gap-1">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className={`h-1 w-1 rounded-full ${i < 8 ? 'bg-accent/40' : 'bg-ink/5'}`} />
                ))}
              </div>
              <span className="text-[8px] font-mono text-ink/20 uppercase tracking-widest">System_Load: Nominal</span>
            </div>

            {/* Subtle Grid Pattern Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
          </div>
        </section>

        {/* Right Column: Weekly Schedule */}
        <section className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold text-ink font-sans tracking-tight">Study Sessions</h2>
          </div>

          <div className="relative space-y-4 before:absolute before:left-[31px] before:top-8 before:bottom-8 before:w-px before:bg-gradient-to-b before:from-transparent before:via-ink/10 before:to-transparent">
            <AnimatePresence mode="popLayout">
              {sessions?.map((session, i) => (
                <motion.div 
                  key={session.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className={`group relative flex items-center gap-8 p-5 bg-surface-low border border-ink/5 rounded-3xl hover:border-accent/20 transition-all duration-500 ${
                    session.completed ? 'opacity-50 grayscale-[0.5]' : ''
                  }`}
                >
                  {/* Timeline Dot/Button */}
                  <div className="relative shrink-0">
                    <button 
                      onClick={() => toggleSession(session.id)}
                      className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-500 ${
                        session.completed 
                          ? 'bg-accent border-accent text-paper shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]' 
                          : 'bg-background border-ink/10 group-hover:border-accent group-hover:text-accent'
                      }`}
                    >
                      {session.completed ? <CheckCircle2 size={18} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                    </button>
                    {!session.completed && (
                      <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  
                  <div className="flex-grow flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center justify-center min-w-[48px] p-2 bg-paper rounded-xl border border-ink/5 shadow-sm">
                        <span className="text-xl font-black text-ink leading-none">{new Date(session.date).getDate()}</span>
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-accent">{new Date(session.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                      </div>
                      
                      <div className="space-y-1">
                        <h3 className={`text-lg font-bold text-ink tracking-tight leading-tight ${session.completed ? 'line-through opacity-40' : ''}`}>
                          {session.subject}
                        </h3>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-muted">
                            <Clock size={12} className="text-accent/50" />
                            {session.startTime}
                          </div>
                          <div className="w-1 h-1 rounded-full bg-ink/10" />
                          <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-muted">
                            <Zap size={12} className="text-accent/50" />
                            {session.duration}m
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-4">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-md border ${
                          session.completed ? 'bg-success/10 border-success/20 text-success' : 'bg-accent/5 border-accent/10 text-accent'
                        }`}>
                          {session.completed ? 'STATUS: COMPLETED' : 'STATUS: SCHEDULED'}
                        </span>
                        <span className="text-[7px] font-mono text-ink/20 uppercase tracking-tighter">Ref: {session.id.slice(0, 8)}</span>
                      </div>
                      <button 
                        onClick={() => deleteSession(session.id)}
                        className="p-2.5 text-muted/20 hover:text-red-500 hover:bg-red-500/5 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {sessions.length === 0 && (
              <div className="py-20 text-center border-2 border-dashed border-ink/5 rounded-3xl space-y-4">
                <div className="w-12 h-12 bg-background rounded-full flex items-center justify-center mx-auto">
                  <Calendar className="w-5 h-5 text-muted/20" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-muted/40 tracking-tight">No sessions scheduled</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted/30">Schedule your first study session</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Modals */}
      {/* Modals */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        maxWidth="2xl"
        title={
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent shadow-sm">
              {addModalTab === 'session' ? <Zap size={24} /> : <Target size={24} />}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] leading-none mb-1.5">
                {addModalTab === 'session' ? 'Study Session' : 'Study Goal'}
              </span>
              <span className="text-xl font-black text-ink leading-none tracking-tight">
                {addModalTab === 'session' ? 'Plan Session' : 'Set Goal'}
              </span>
            </div>
          </div>
        }
      >
        <div className="space-y-8">
          <div className="flex items-center gap-2 p-1 bg-surface-low rounded-2xl border border-ink/5">
            <button 
              onClick={() => setAddModalTab('session')}
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${
                addModalTab === 'session' 
                  ? 'bg-paper text-accent shadow-sm' 
                  : 'text-muted hover:text-ink'
              }`}
            >
              Session
            </button>
            <button 
              onClick={() => setAddModalTab('goal')}
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${
                addModalTab === 'goal' 
                  ? 'bg-paper text-accent shadow-sm' 
                  : 'text-muted hover:text-ink'
              }`}
            >
              Goal
            </button>
          </div>

          {addModalTab === 'session' ? (
            <form onSubmit={addSession} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-1">Subject or Topic</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Advanced Calculus"
                  value={newSession.subject}
                  onChange={(e) => setNewSession({...newSession, subject: e.target.value})}
                  className="w-full bg-surface-low/50 border border-ink/10 rounded-2xl p-5 text-sm font-medium text-ink focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all outline-none placeholder:text-ink/20"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-1">Date</label>
                  <input 
                    type="date" 
                    required
                    value={newSession.date}
                    onChange={(e) => setNewSession({...newSession, date: e.target.value})}
                    className="w-full bg-surface-low/50 border border-ink/10 rounded-2xl p-5 text-sm font-mono text-ink focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-1">Start Time</label>
                  <input 
                    type="time" 
                    required
                    value={newSession.startTime}
                    onChange={(e) => setNewSession({...newSession, startTime: e.target.value})}
                    className="w-full bg-surface-low/50 border border-ink/10 rounded-2xl p-5 text-sm font-mono text-ink focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-1">Duration (Minutes)</label>
                <div className="grid grid-cols-4 gap-3">
                  {[30, 60, 90, 120].map(dur => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setNewSession({...newSession, duration: dur})}
                      className={`py-4 rounded-2xl text-xs font-mono font-bold transition-all border-2 ${
                        newSession.duration === dur 
                          ? 'bg-accent border-accent text-paper shadow-lg shadow-accent/20' 
                          : 'bg-surface-low border-transparent text-muted hover:border-ink/5 hover:text-ink'
                      }`}
                    >
                      {dur}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 pt-6 border-t border-ink/5">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-8 py-4 bg-ink text-paper rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all flex items-center gap-2 shadow-xl shadow-ink/10"
                >
                  <Zap size={14} />
                  Save Session
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={addGoal} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-1">Goal Title</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Complete Advanced Calculus Module"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({...newGoal, title: e.target.value})}
                  className="w-full bg-surface-low/50 border border-ink/10 rounded-2xl p-5 text-sm font-medium text-ink focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all outline-none placeholder:text-ink/20"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-1">Deadline</label>
                <input 
                  type="date" 
                  required
                  value={newGoal.deadline}
                  onChange={(e) => setNewGoal({...newGoal, deadline: e.target.value})}
                  className="w-full bg-surface-low/50 border border-ink/10 rounded-2xl p-5 text-sm font-mono text-ink focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-4 pt-6 border-t border-ink/5">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-8 py-4 bg-ink text-paper rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent transition-all flex items-center gap-2 shadow-xl shadow-ink/10"
                >
                  <Target size={14} />
                  Save Goal
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </Layout>
  );
};
