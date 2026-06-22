import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  User, 
  Mail, 
  Globe, 
  GraduationCap, 
  Settings, 
  ChevronRight,
  BookOpen,
  KeyRound,
  Timer,
  RefreshCw,
  TrendingUp,
  Activity
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../db/supabase';
import { AiKeysModal } from '../components/settings/AiKeysModal';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

// ⚡ Bolt: Stable fallback array to prevent cascading re-renders when useLiveQuery loads
const EMPTY_ARRAY: any[] = [];

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const { t } = useLanguage();
  const dbSettings = useLiveQuery(() => db.settings.toArray(), EMPTY_ARRAY);
  const settings = React.useMemo(
    () => Object.fromEntries((dbSettings || EMPTY_ARRAY).map((setting) => [setting.key, setting.value])),
    [dbSettings],
  );
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

  const isAcademicLoading = loading || dbSettings === undefined;
  const browserGrade = localStorage.getItem('selected_grade') || '';
  const hasPersistedAcademicGrade = Boolean(profile?.selected_grade || settings.selected_grade);
  const selectedGrade =
    profile?.selected_grade ||
    settings.selected_grade ||
    (browserGrade === 'Grade 12' && !hasPersistedAcademicGrade ? '' : browserGrade) ||
    (isAcademicLoading ? 'Loading...' : '');
  const selectedCountry = settings.selected_country || localStorage.getItem('selected_country') || '';
  const selectedBacTrackId = profile?.selected_bac_track || settings.selected_bac_track || localStorage.getItem('selected_bac_track') || '';

  const [bacTrackName, setBacTrackName] = React.useState<string>('');

  React.useEffect(() => {
    const fetchTrackName = async () => {
      if (selectedBacTrackId) {
        // UUID validation check
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedBacTrackId);

        if (isUUID) {
          const { data } = await supabase.from('tracks').select('name').eq('id', selectedBacTrackId).single();
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
    { label: 'Grade Level', value: selectedGrade || 'Not set', icon: <GraduationCap className="w-4 h-4" />, color: 'text-blue-500' },
    { label: 'Region', value: selectedCountry || 'Not set', icon: <Globe className="w-4 h-4" />, color: 'text-emerald-500' },
    { label: 'Track', value: bacTrackName || 'Not set', icon: <BookOpen className="w-4 h-4" />, color: 'text-accent' },
    { label: 'Account', value: profile?.plan || 'Free', icon: <User className="w-4 h-4" />, color: 'text-amber-500' },
  ];

  return (
    <Layout fullWidth>
      <SEO title="Profile" />
      <div className="h-full w-full bg-background flex flex-col overflow-hidden p-4">
        {/* 3-Column Layout */}
        <div className="flex-grow min-h-0 w-full flex flex-col lg:flex-row gap-3 overflow-hidden">

          {/* Column 2: Main Content */}
          <div className="flex-grow flex flex-col min-h-0 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-white/8 dark:bg-paper">
            <div className="flex-grow overflow-y-auto no-scrollbar flex flex-col gap-5">
              {/* Profile Header */}
              <div className="relative rounded-2xl border border-ink/5 bg-paper p-5 shadow-sm sm:p-6">
                
                <div className="relative flex flex-col items-center gap-5 md:flex-row md:items-start">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-accent/20 bg-accent/10 shadow-md sm:h-24 sm:w-24">
                    {profile?.avatar_url ? (
                      <img 
                        src={profile.avatar_url} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="h-10 w-10 text-accent sm:h-12 sm:w-12" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2 text-center md:text-left">
                    <div className="flex min-w-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
                      <h1 className="min-w-0 break-words text-2xl font-serif font-medium text-ink sm:text-3xl">
                        {profile?.full_name || user?.email?.split('@')[0] || 'Scholar'}
                      </h1>
                      <span className="inline-flex max-w-full self-center truncate rounded-full bg-ink px-3 py-1 text-[10px] font-bold uppercase tracking-normal text-paper md:self-auto">
                        Academic Level: {selectedGrade || 'Not set'}
                      </span>
                      {bacTrackName && (
                        <span className="inline-flex max-w-full self-center truncate rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-normal text-accent md:self-auto">
                          Track: {bacTrackName}
                        </span>
                      )}
                    </div>
                    <p className="flex min-w-0 items-center justify-center gap-2 text-muted md:justify-start">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{user?.email}</span>
                    </p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted">
                        <Globe className="w-3.5 h-3.5" />
                        {selectedCountry || 'Not set'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="min-w-0 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-5 dark:border-white/5 dark:bg-surface-low/20"
                  >
                    <div className={`w-9 h-9 rounded-xl bg-background flex items-center justify-center ${stat.color}`}>
                      {stat.icon}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted uppercase tracking-normal">{stat.label}</p>
                      <p className="truncate text-xl font-bold text-ink">{stat.value}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Academic Context */}
              <div className="space-y-5 rounded-2xl border border-slate-100 bg-slate-50/50 p-5 dark:border-white/5 dark:bg-surface-low/20 sm:p-6">
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
                      <div><p className="text-[10px] font-bold text-muted uppercase tracking-normal">Grade Level</p><p className="text-sm font-medium text-ink">{selectedGrade || 'Not set'}</p></div>
                    </div>
                    {bacTrackName && (
                      <div className="flex items-center gap-3 p-4 bg-background rounded-2xl border border-ink/5">
                        <div className="w-9 h-9 rounded-xl bg-accent/5 flex items-center justify-center text-accent"><BookOpen className="w-5 h-5" /></div>
                        <div><p className="text-[10px] font-bold text-muted uppercase tracking-normal">Track</p><p className="text-sm font-medium text-ink">{bacTrackName}</p></div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 p-4 bg-background rounded-2xl border border-ink/5">
                      <div className="w-9 h-9 rounded-xl bg-accent/5 flex items-center justify-center text-accent"><Globe className="w-5 h-5" /></div>
                      <div><p className="text-[10px] font-bold text-muted uppercase tracking-normal">Region</p><p className="text-sm font-medium text-ink">{selectedCountry || 'Not set'}</p></div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Column 3: Right Sidebar */}
          <div className="flex lg:w-[234px] w-full shrink-0 h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-white/8 dark:bg-paper">
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
