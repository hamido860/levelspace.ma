import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Layers, 
  BookOpen, 
  Target, 
  ArrowRight, 
  Timer,
  BarChart3,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const handleCTA = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-background text-ink font-sans selection:bg-accent/10 selection:text-accent overflow-x-hidden lg:scale-[0.85] lg:origin-top">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-ink/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-paper shadow-lg shadow-accent/20">
              <Layers className="w-6 h-6" />
            </div>
            <span className="text-xl font-display font-bold tracking-tight">LevelSpace</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleCTA}
              className="px-6 py-2.5 bg-ink text-paper rounded-full font-medium text-sm hover:bg-accent transition-colors flex items-center gap-2"
            >
              {user ? t('dashboard') : 'Sign In'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 relative">
        {/* Line Art Background Image */}
        <div 
          className="absolute inset-0 z-0 pointer-events-none opacity-[0.04] mix-blend-multiply" 
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)'
          }}
        ></div>
        
        {/* Ambient Background */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-surface-mid rounded-full blur-[120px] -z-10"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[120px] -z-10"></div>

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-low text-ink-secondary text-xs font-bold uppercase tracking-widest mb-8 border border-ink/10"
          >
            <Target className="w-4 h-4" />
            <span>{t('academic_region')}</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-display font-bold tracking-tight leading-[1.1] mb-8 max-w-5xl mx-auto"
          >
            {t('hero_title')}
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-ink-muted max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            {t('hero_subtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button 
              onClick={handleCTA}
              className="w-full sm:w-auto px-8 py-4 bg-accent text-paper rounded-full font-bold text-lg shadow-xl shadow-accent/20 hover:bg-accent-hover hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {t('hero_cta_primary')}
              <ArrowRight className="w-5 h-5" />
            </button>
            <button 
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto px-8 py-4 bg-paper text-ink border border-ink/10 rounded-full font-bold text-lg hover:bg-surface-low transition-all"
            >
              {t('hero_cta_secondary')}
            </button>
          </motion.div>
        </div>
      </section>

      {/* Visual Mockup Section */}
      <section className="py-12 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="md:col-span-2 relative rounded-3xl border border-ink/10 bg-paper shadow-2xl overflow-hidden aspect-[16/9] md:aspect-auto md:h-[400px] group"
            >
              <div className="absolute inset-0 bg-ink/10 group-hover:bg-transparent transition-colors z-10"></div>
              <img 
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2564&auto=format&fit=crop" 
                alt="Happy students collaborating" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
            </motion.div>
            <div className="flex flex-col gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="relative rounded-3xl border border-ink/10 bg-paper shadow-xl overflow-hidden h-[188px] group"
              >
                <div className="absolute inset-0 bg-ink/10 group-hover:bg-transparent transition-colors z-10"></div>
                <img 
                  src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=2564&auto=format&fit=crop" 
                  alt="Focused student studying" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="relative rounded-3xl border border-ink/10 bg-paper shadow-xl overflow-hidden h-[188px] group"
              >
                <div className="absolute inset-0 bg-ink/10 group-hover:bg-transparent transition-colors z-10"></div>
                <img 
                  src="https://images.unsplash.com/photo-1456406644174-8ddd4cd52a06?q=80&w=2564&auto=format&fit=crop" 
                  alt="Student writing notes" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-paper">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-4">Everything you need for excellence.</h2>
            <p className="text-ink-muted text-lg max-w-2xl mx-auto">A complete productivity ecosystem designed to accelerate your understanding and retention of any topic.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <BookOpen className="w-6 h-6" />,
                title: "Curriculum Organization",
                desc: "Structure your semesters, break down complex modules, and keep all your study materials in one unified workspace."
              },
              {
                icon: <Timer className="w-6 h-6" />,
                title: "Deep Work Sessions",
                desc: "Utilize built-in Pomodoro timers and distraction-free modes to maximize your study efficiency."
              },
              {
                icon: <BarChart3 className="w-6 h-6" />,
                title: "Progress Tracking",
                desc: "Monitor your study habits, track task completion, and visualize your academic growth over time."
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="p-8 rounded-3xl bg-surface-low border border-ink/5 hover:border-accent/20 transition-colors group"
              >
                <div className="w-12 h-12 bg-paper rounded-2xl flex items-center justify-center text-accent shadow-sm mb-6 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-ink-muted leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto bg-[#0D1117] rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden">
          {/* Line Art Background Image */}
          <div 
            className="absolute inset-0 z-0 pointer-events-none opacity-[0.15] mix-blend-screen" 
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          ></div>
          
          <div className="absolute inset-0 bg-accent/20 blur-[100px] rounded-full transform -translate-y-1/2 z-0"></div>
          <div className="relative z-10">
            <h2 className="text-4xl md:text-6xl font-display font-bold text-white mb-6">Ready to transform your study habits?</h2>
            <p className="text-white/70 text-lg md:text-xl max-w-2xl mx-auto mb-10">
              Join thousands of students who are organizing their academic life with LevelSpace.
            </p>
            <button 
              onClick={handleCTA}
              className="px-10 py-5 bg-accent text-white rounded-full font-bold text-lg shadow-2xl shadow-accent/50 hover:bg-accent-hover hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 mx-auto"
            >
              {user ? 'Enter Dashboard' : 'Get Started for Free'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-ink/5 bg-paper">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-ink">
            <Layers className="w-5 h-5 text-accent" />
            <span className="font-display font-bold">LevelSpace</span>
          </div>
          <p className="text-sm text-ink-muted">© {new Date().getFullYear()} LevelSpace. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};
