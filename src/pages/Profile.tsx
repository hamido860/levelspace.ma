import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  User, 
  Mail, 
  Globe, 
  GraduationCap, 
  Brain, 
  Target, 
  Settings, 
  ChevronRight,
  Award,
  Zap,
  Clock,
  BookOpen,
  KeyRound,
  Timer,
  RefreshCw,
  LayoutGrid,
  TrendingUp,
  Activity
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { supabase } from '../db/supabase';
import { AiKeysModal } from '../components/settings/AiKeysModal';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { settings } = useAppSettings();
  const [isAiKeysOpen, setIsAiKeysOpen] = React.useState(false);
  const [timerSeconds, setTimerSeconds] = React.useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s > 0 ? s - 1 : 0), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTimerRunning]);
  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const selectedGrade = settings['selected_grade'] || localStorage.getItem('selected_grade') || 'Grade 12';
  const selectedCountry = settings['selected_country'] || localStorage.getItem('selected_country') || '';
  const selectedGoal = settings['selected_goal'] || localStorage.getItem('selected_goal') || 'mastery';
  const selectedBacTrackId = settings['selected_bac_track'] || localStorage.getItem('selected_bac_track') || '';

  const [bacTrackName, setBacTrackName] = React.useState<string>('');

  React.useEffect(() => {
    const fetchTrackName = async () => {
      if (selectedBacTrackId) {
        // UUID validation check
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedBacTrackId);

        if (isUUID) {
          const { data } = await supabase.from('bac_tracks').select('name').eq('id', selectedBacTrackId).single();
          if (data) {
            setBacTrackName(data.name);
          }
        } else {
          // If not UUID, it's already the name
          setBacTrackName(selectedBacTrackId);
        }
      }
    };
    fetchTrackName();
  }, [selectedBacTrackId]);

  const stats = [
    { label: 'Modules Active', value: '12', icon: <BookOpen className="w-4 h-4" />, color: 'text-blue-500' },
    { label: 'Deep Work', value: '24.5h', icon: <Clock className="w-4 h-4" />, color: 'text-emerald-500' },
    { label: 'Mastery', value: '88%', icon: <Zap className="w-4 h-4" />, color: 'text-accent' },
    { label: 'Achievements', value: '15', icon: <Award className="w-4 h-4" />, color: 'text-amber-500' },
  ];

  return (
    <Layout fullWidth>
      <SEO title="Profile" />
      <div className="h-full w-full bg-background flex flex-col overflow-hidden p-4">
        {/* 3-Column Layout */}
        <div className="flex-grow min-h-0 w-full flex flex-col lg:flex-row gap-4 overflow-hidden">

          {/* Column 1: Left Sidebar — User Identity */}
          <div className="hidden lg:flex lg:w-[220px] w-full shrink-0 h-full bg-white dark:bg-paper rounded-3xl shadow-lg border border-slate-200 dark:border-white/8 overflow-hidden flex-col p-5">
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-5">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3 pb-4 border-b border-slate-100 dark:border-white/5">
                <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center border-2 border-accent/20 overflow-hidden shadow-md">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-10 h-10 text-accent" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-800 dark:text-ink truncate max-w-[160px]">{profile?.full_name || user?.email?.split('@')[0] || 'Scholar'}</p>
                  <p className="text-[10px] text-slate-400 dark:text-ink-muted">{selectedGrade}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-2">
                <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider">Stats</p>
                {stats.map((stat, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-surface-low/30 rounded-xl border border-slate-100 dark:border-white/5">
                    <div className={`flex items-center gap-2 ${stat.color}`}>
                      {stat.icon}
                      <span className="text-[11px] font-medium text-slate-600 dark:text-ink-secondary">{stat.label}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800 dark:text-ink">{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* Nav Links */}
              <div className="space-y-2">
                <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider">Navigate</p>
                {[
                  { label: 'Dashboard', path: '/dashboard', icon: <TrendingUp size={13} /> },
                  { label: 'Classrooms', path: '/modules', icon: <LayoutGrid size={13} /> },
                  { label: 'LevelUp', path: '/levelup', icon: <Activity size={13} /> },
                  { label: 'Settings', path: '/settings', icon: <Settings size={13} /> },
                ].map((link, i) => (
                  <button key={i} onClick={() => navigate(link.path)}
                    className="w-full flex items-center gap-2 p-3 bg-slate-50 dark:bg-surface-low/30 rounded-xl border border-slate-100 dark:border-white/5 hover:border-accent/30 transition-all">
                    <span className="text-accent">{link.icon}</span>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-ink">{link.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Main Content */}
          <div className="flex-grow flex flex-col min-h-0 w-full overflow-hidden bg-white dark:bg-paper rounded-3xl shadow-lg border border-slate-200 dark:border-white/8 p-6">
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-6">        {/* Profile Header */}
              <div className="relative p-8 bg-paper border border-ink/5 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                
                <div className="relative flex flex-col md:flex-row items-center gap-8">
                  <div className="w-32 h-32 rounded-3xl bg-accent/10 flex items-center justify-center border-2 border-accent/20 overflow-hidden shadow-md">
                    {profile?.avatar_url ? (
                      <img 
                        src={profile.avatar_url} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-16 h-16 text-accent" />
                    )}
                  </div>

                  <div className="flex-grow text-center md:text-left space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 flex-wrap">
                      <h1 className="text-3xl font-serif font-medium text-ink">
                        {profile?.full_name || user?.email?.split('@')[0] || 'Scholar'}
                      </h1>
                      <span className="inline-flex px-3 py-1 bg-ink text-paper text-[10px] font-bold uppercase tracking-normal rounded-full self-center md:self-auto whitespace-nowrap">
                        Academic Level: {selectedGrade}
                      </span>
                      {bacTrackName && (
                        <span className="inline-flex px-3 py-1 bg-accent/10 text-accent border border-accent/20 text-[10px] font-bold uppercase tracking-normal rounded-full self-center md:self-auto whitespace-nowrap">
                          Track: {bacTrackName}
                        </span>
                      )}
                    </div>
                    <p className="text-muted flex items-center justify-center md:justify-start gap-2">
                      <Mail className="w-4 h-4" />
                      {user?.email}
                    </p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted">
                        <Globe className="w-3.5 h-3.5" />
                        {selectedCountry}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium text-muted">
                        <Target className="w-3.5 h-3.5" />
                        Goal: {selectedGoal}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-5 bg-slate-50/50 dark:bg-surface-low/20 border border-slate-100 dark:border-white/5 rounded-2xl space-y-3"
                  >
                    <div className={`w-9 h-9 rounded-xl bg-background flex items-center justify-center ${stat.color}`}>
                      {stat.icon}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted uppercase tracking-normal">{stat.label}</p>
                      <p className="text-2xl font-bold text-ink">{stat.value}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Academic Context */}
              <div className="p-6 bg-slate-50/50 dark:bg-surface-low/20 border border-slate-100 dark:border-white/5 rounded-[2rem] space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-serif font-medium text-ink">Academic Context</h2>
                  <button onClick={() => navigate('/settings')}
                    className="text-xs font-bold text-accent uppercase tracking-normal hover:underline flex items-center gap-1">
                    Edit <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-4 bg-background rounded-2xl border border-ink/5">
                      <div className="w-9 h-9 rounded-xl bg-accent/5 flex items-center justify-center text-accent"><GraduationCap className="w-5 h-5" /></div>
                      <div><p className="text-[10px] font-bold text-muted uppercase tracking-normal">Grade Level</p><p className="text-sm font-medium text-ink">{selectedGrade}</p></div>
                    </div>
                    {bacTrackName && (
                      <div className="flex items-center gap-3 p-4 bg-background rounded-2xl border border-ink/5">
                        <div className="w-9 h-9 rounded-xl bg-accent/5 flex items-center justify-center text-accent"><BookOpen className="w-5 h-5" /></div>
                        <div><p className="text-[10px] font-bold text-muted uppercase tracking-normal">Track</p><p className="text-sm font-medium text-ink">{bacTrackName}</p></div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 p-4 bg-background rounded-2xl border border-ink/5">
                      <div className="w-9 h-9 rounded-xl bg-accent/5 flex items-center justify-center text-accent"><Globe className="w-5 h-5" /></div>
                      <div><p className="text-[10px] font-bold text-muted uppercase tracking-normal">Region</p><p className="text-sm font-medium text-ink">{selectedCountry}</p></div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-4 bg-background rounded-2xl border border-ink/5">
                      <div className="w-9 h-9 rounded-xl bg-accent/5 flex items-center justify-center text-accent"><Brain className="w-5 h-5" /></div>
                      <div><p className="text-[10px] font-bold text-muted uppercase tracking-normal">Primary Interest</p><p className="text-sm font-medium text-ink">Neuroscience</p></div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-background rounded-2xl border border-ink/5">
                      <div className="w-9 h-9 rounded-xl bg-accent/5 flex items-center justify-center text-accent"><Target className="w-5 h-5" /></div>
                      <div><p className="text-[10px] font-bold text-muted uppercase tracking-normal">Current Goal</p><p className="text-sm font-medium text-ink">{selectedGoal}</p></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Achievements */}
              <div className="p-6 bg-slate-50/50 dark:bg-surface-low/20 border border-slate-100 dark:border-white/5 rounded-[2rem] space-y-4">
                <h2 className="text-lg font-serif font-medium text-ink">Recent Achievements</h2>
                <div className="space-y-3">
                  {[
                    { title: 'Deep Work Streak', desc: '5 days of focused study', date: '2 hours ago' },
                    { title: 'Mastery Milestone', desc: 'Reached 90% in Calculus', date: 'Yesterday' },
                    { title: 'Quiz Champion', desc: 'Perfect score on Biology quiz', date: '3 days ago' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-background rounded-2xl border border-ink/5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                          <Award className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-ink">{item.title}</p>
                          <p className="text-xs text-muted">{item.desc}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-muted/60">{item.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Right Sidebar */}
          <div className="hidden lg:flex lg:w-[260px] w-full shrink-0 h-full bg-white dark:bg-paper rounded-3xl shadow-lg border border-slate-200 dark:border-white/8 overflow-hidden flex-col p-5">
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-6 pr-1">

              {/* Deep Focus Timer */}
              <section className="bg-slate-950 text-white rounded-2xl p-5 relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Deep Focus</h3>
                  <div className="text-3xl font-bold tracking-tight mb-3">{formatTime(timerSeconds)}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsTimerRunning(!isTimerRunning)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        isTimerRunning ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-accent text-white hover:bg-accent/90'
                      }`}
                    >
                      {isTimerRunning ? 'Pause' : 'Start Timer'}
                    </button>
                    <button
                      onClick={() => { setIsTimerRunning(false); setTimerSeconds(25 * 60); }}
                      className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-700 transition-all"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>
              </section>

              {/* API Keys */}
              <section className="bg-slate-50 dark:bg-surface-low/30 rounded-2xl p-4 border border-slate-100 dark:border-white/5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">Bring Your Own Key</h3>
                    <p className="text-xs text-muted">Configure private AI credentials.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAiKeysOpen(true)}
                  className="w-full py-2.5 bg-ink hover:bg-accent text-paper hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound size={13} />
                  Manage API Keys
                </button>
              </section>

              {/* Quick Links */}
              <section className="space-y-3">
                <p className="text-[9px] font-bold text-slate-400 dark:text-ink-muted uppercase tracking-wider">Quick Links</p>
                {[
                  { label: 'Dashboard', path: '/dashboard', icon: <TrendingUp size={13} /> },
                  { label: 'LevelUp', path: '/levelup', icon: <Activity size={13} /> },
                  { label: 'Settings', path: '/settings', icon: <Settings size={13} /> },
                ].map((link, i) => (
                  <button key={i} onClick={() => navigate(link.path)}
                    className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-surface-low/30 rounded-xl border border-slate-100 dark:border-white/5 hover:border-accent/30 transition-all">
                    <div className="flex items-center gap-2">
                      <span className="text-accent">{link.icon}</span>
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-ink">{link.label}</span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-muted" />
                  </button>
                ))}
              </section>

            </div>
          </div>

        </div>
      </div>
      <AiKeysModal 
        isOpen={isAiKeysOpen} 
        onClose={() => setIsAiKeysOpen(false)} 
        mode="user" 
      />
    </Layout>
  );
};
