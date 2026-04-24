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
  BookOpen
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { supabase } from '../db/supabase';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const { settings } = useAppSettings();

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
    <Layout>
      <SEO title="Profile" />
      <div className="max-w-5xl mx-auto space-y-8 py-8 px-4">
        {/* Profile Header */}
        <div className="relative p-8 bg-paper border border-ink/5 rounded-[2rem] overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          
          <div className="relative flex flex-col md:flex-row items-center gap-8">
            <div className="w-32 h-32 rounded-3xl bg-accent/10 flex items-center justify-center border-2 border-accent/20 overflow-hidden shadow-xl">
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
                <span className="inline-flex px-3 py-1 bg-ink text-paper text-[10px] font-bold uppercase tracking-widest rounded-full self-center md:self-auto whitespace-nowrap">
                  Academic Level: {selectedGrade}
                </span>
                {bacTrackName && (
                  <span className="inline-flex px-3 py-1 bg-accent/10 text-accent border border-accent/20 text-[10px] font-bold uppercase tracking-widest rounded-full self-center md:self-auto whitespace-nowrap">
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

            <button 
              onClick={() => navigate('/settings')}
              className="p-4 bg-background border border-ink/10 rounded-2xl hover:border-accent/30 transition-all group"
            >
              <Settings className="w-5 h-5 text-muted group-hover:text-accent transition-colors" />
            </button>
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
              className="p-6 bg-paper border border-ink/5 rounded-3xl shadow-sm space-y-3"
            >
              <div className={`w-10 h-10 rounded-xl bg-background flex items-center justify-center ${stat.color}`}>
                {stat.icon}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{stat.label}</p>
                <p className="text-2xl font-bold text-ink">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Academic Context Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-8 bg-paper border border-ink/5 rounded-[2rem] shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-serif font-medium text-ink">Academic Context</h2>
                <button 
                  onClick={() => navigate('/settings')}
                  className="text-xs font-bold text-accent uppercase tracking-widest hover:underline flex items-center gap-1"
                >
                  Edit Profile <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-background rounded-2xl border border-ink/5">
                    <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Grade Level</p>
                      <p className="text-sm font-medium text-ink">{selectedGrade}</p>
                    </div>
                  </div>

                  {bacTrackName && (
                    <div className="flex items-center gap-4 p-4 bg-background rounded-2xl border border-ink/5">
                      <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Track</p>
                        <p className="text-sm font-medium text-ink">{bacTrackName}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 p-4 bg-background rounded-2xl border border-ink/5">
                    <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Region</p>
                      <p className="text-sm font-medium text-ink">{selectedCountry}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-background rounded-2xl border border-ink/5">
                    <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
                      <Brain className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Primary Interest</p>
                      <p className="text-sm font-medium text-ink">Neuroscience</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-background rounded-2xl border border-ink/5">
                    <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Current Goal</p>
                      <p className="text-sm font-medium text-ink">{selectedGoal}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity Placeholder */}
            <div className="p-8 bg-paper border border-ink/5 rounded-[2rem] shadow-sm space-y-6">
              <h2 className="text-xl font-serif font-medium text-ink">Recent Achievements</h2>
              <div className="space-y-4">
                {[
                  { title: 'Deep Work Streak', desc: '5 days of focused study', date: '2 hours ago' },
                  { title: 'Mastery Milestone', desc: 'Reached 90% in Calculus', date: 'Yesterday' },
                  { title: 'Quiz Champion', desc: 'Perfect score on Biology quiz', date: '3 days ago' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-background rounded-2xl border border-ink/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
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

          {/* Sidebar Info */}
          <div className="space-y-8">
            <div className="p-8 bg-ink text-paper rounded-[2rem] shadow-xl space-y-6">
              <h3 className="text-lg font-serif font-medium">Pro Membership</h3>
              <p className="text-sm text-paper/60 leading-relaxed">
                Unlock unlimited classrooms, advanced AI tutoring, and detailed progress mapping.
              </p>
              <button className="w-full py-4 bg-accent text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-accent/90 transition-colors">
                Upgrade to Pro
              </button>
            </div>

            <div className="p-8 bg-paper border border-ink/5 rounded-[2rem] shadow-sm space-y-6">
              <h3 className="text-lg font-serif font-medium text-ink">Quick Links</h3>
              <div className="space-y-2">
                {[
                  { label: 'My Progress', path: '/progress' },
                  { label: 'Study Planner', path: '/schedule' },
                  { label: 'Library', path: '/library' },
                  { label: 'Settings', path: '/settings' },
                ].map((link, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(link.path)}
                    className="w-full flex items-center justify-between p-4 bg-background rounded-2xl border border-ink/5 hover:border-accent/30 transition-all text-sm font-medium text-ink"
                  >
                    {link.label}
                    <ChevronRight className="w-4 h-4 text-muted" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
