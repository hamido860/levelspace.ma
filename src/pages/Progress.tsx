import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  BarChart3, 
  Timer, 
  BookOpen, 
  Calendar, 
  ChevronLeft,
  Zap,
  Brain,
  Target,
  ArrowUpRight,
  Sparkles,
  AlertCircle
} from 'lucide-react';

const focusData = [
  { day: 'Mon', hours: 4.2, intensity: 85 },
  { day: 'Tue', hours: 3.8, intensity: 70 },
  { day: 'Wed', hours: 5.5, intensity: 95 },
  { day: 'Thu', hours: 2.9, intensity: 60 },
  { day: 'Fri', hours: 4.8, intensity: 80 },
  { day: 'Sat', hours: 1.5, intensity: 40 },
  { day: 'Sun', hours: 0.5, intensity: 20 },
];

const subjectMastery = [
  { subject: 'Cognitive Neuroscience', mastery: 72, color: '#5A5A40' },
  { subject: 'Advanced Calculus', mastery: 45, color: '#8E9299' },
  { subject: 'Thematic Analysis', mastery: 88, color: '#141414' },
  { subject: 'Academic Writing', mastery: 60, color: '#5A5A40' },
];

export const Progress: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Layout>
      <SEO title="Progress" />
      <div className="space-y-12">
        {/* Top Stats - Hardware Aesthetic */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Focus Quotient', value: '8.4', unit: '/10', icon: <Brain />, trend: '+12%' },
            { label: 'Deep Work Total', value: '24.5', unit: 'hrs', icon: <Timer />, trend: '+4.2h' },
            { label: 'Mastery Delta', value: '+18', unit: '%', icon: <Zap />, trend: 'Optimal' },
            { label: 'Lessons Missed', value: '2', unit: '', icon: <AlertCircle />, trend: '-1 this week' }
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              viewport={{ once: true }}
              className="bg-paper p-5 rounded-2xl border border-ink/5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center text-muted">
                  {React.cloneElement(stat.icon as React.ReactElement<any>, { size: 16 })}
                </div>
                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">{stat.trend}</span>
              </div>
              
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-muted uppercase tracking-widest">{stat.label}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-ink">{stat.value}</span>
                  <span className="text-[10px] font-medium text-muted">{stat.unit}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </section>

        {/* Focus Distribution Chart */}
        <section className="space-y-6">
          <div className="flex items-end justify-between border-b border-ink/5 pb-4">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Temporal Mapping</p>
              <h3 className="text-xl md:text-2xl font-bold text-ink font-sans tracking-tight">Focus Distribution</h3>
            </div>
          </div>

          <div className="h-[220px] w-full bg-paper rounded-3xl p-6 border border-ink/5 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={focusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0, 0, 0, 0.03)" />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: '600', fill: '#A1A1AA' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: '600', fill: '#A1A1AA' }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }}
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    border: '1px solid #f1f5f9', 
                    borderRadius: '1rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    color: '#141414',
                    fontSize: '0.75rem',
                    padding: '0.75rem'
                  }}
                />
                <Bar 
                  dataKey="hours" 
                  radius={[6, 6, 0, 0]} 
                  barSize={32}
                >
                  {focusData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.intensity > 80 ? '#9CA3AF' : '#E5E7EB'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Mastery Section & Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Mastery Section */}
          <section className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-muted uppercase tracking-widest">Subject Mastery</h3>
              <span className="text-[9px] font-bold text-muted/40 uppercase tracking-widest">Last 30 Days</span>
            </div>
            
            <div className="grid gap-3">
              {subjectMastery.map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  viewport={{ once: true }}
                  className="bg-paper p-4 rounded-xl border border-ink/5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink">{item.subject}</span>
                    <span className="text-[10px] font-bold text-muted">{item.mastery}%</span>
                  </div>
                  <div className="h-1 bg-background rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      whileInView={{ width: `${item.mastery}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      viewport={{ once: true }}
                      className="h-full bg-accent"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Insight Card */}
          <section className="lg:col-span-5">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-ink text-paper p-6 rounded-2xl space-y-6"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Target size={14} className="text-accent" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">AI Insight</span>
                </div>
                <h4 className="text-xl font-bold leading-tight">Your cognitive peak occurs between 10 AM and 12 PM.</h4>
              </div>
              
              <p className="text-xs text-white/60 leading-relaxed">
                Data suggests that scheduling your most complex subjects during this window results in a 24% increase in retention. 
              </p>
              
              <button 
                onClick={() => navigate('/schedule')}
                className="w-full py-3 bg-accent text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-paper hover:text-ink transition-all"
              >
                Optimize Schedule
              </button>
            </motion.div>
          </section>
        </div>
      </div>
    </Layout>
  );
};
