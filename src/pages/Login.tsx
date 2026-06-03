import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { supabase } from '../db/supabase';
import { 
  ArrowRight, 
  LogIn, 
  Facebook, 
  Mail, 
  Lock, 
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInDemoAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate(from || '/dashboard');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: email.split('@')[0],
            }
          }
        });
        if (error) throw error;

        if (data.session) {
          navigate(from || '/dashboard');
        } else {
          alert('Check your email for the confirmation link!');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      if (err.message.includes('not enabled')) {
        setError(`The ${provider} login provider is not enabled. Please enable it in your Supabase Dashboard under Authentication > Providers.`);
      } else {
        setError(err.message);
      }
    }
  };

  const handleDemoAdminLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      await signInDemoAdmin();
      navigate(from || '/admin');
    } catch (err: any) {
      setError(err.message || 'Unable to start demo admin mode.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout hideSidebar>
      <SEO title={mode === 'login' ? "Login" : "Sign Up"} />
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4 md:p-8 font-sans relative overflow-hidden">
        {/* Background Accents with Animation */}
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-accent/20 via-accent/5 to-transparent blur-3xl pointer-events-none" 
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-accent/15 via-transparent to-transparent blur-3xl pointer-events-none" 
        />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-[54rem] overflow-hidden rounded-[2rem] border border-white/20 bg-paper/85 backdrop-blur-xl shadow-2xl shadow-ink/5 relative z-10 grid min-h-[500px] lg:grid-cols-[0.8fr_1.2fr]"
        >
          {/* Left Panel: Premium Branding & Info showcase (Hidden on mobile) */}
          <aside className="relative hidden overflow-hidden bg-slate-950 p-8 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute -right-20 -top-16 h-64 w-64 rounded-full bg-accent/30 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-14 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />
            
            <div className="relative">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-lg shadow-accent/30">
                  <Sparkles className="h-5 w-5" />
                </div>
                <span className="font-display text-lg font-bold tracking-tight">Levelspace</span>
              </div>
              <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-blue-300">Authentication Command Center</p>
              <h2 className="max-w-xs text-xl font-bold leading-tight">Content is everywhere. Guidance is not.</h2>
              <p className="mt-2 max-w-xs text-[11px] leading-relaxed text-white/60">
                Unlock your personalized learning space. Track focus, master subjects, and level up with AI-guided curriculums.
              </p>
            </div>

            <div className="relative space-y-2 mt-6">
              {[
                ['01', 'Curriculum-aware classrooms'],
                ['02', 'AI-guided modular lessons'],
                ['03', 'Deep focus & mastery metrics'],
              ].map(([number, label]) => (
                <div key={number} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span className="text-[10px] font-bold tracking-widest text-blue-300">{number}</span>
                  <span className="text-xs font-medium text-white/80">{label}</span>
                </div>
              ))}
            </div>
          </aside>

          {/* Right Panel: Clean form selection & inputs */}
          <div className="p-8 md:p-10 flex flex-col justify-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-serif font-medium tracking-tight text-ink">
                {mode === 'login' ? 'Welcome back' : 'Create your space'}
              </h2>
              <p className="text-muted text-xs font-light">
                {mode === 'login' ? 'Please enter your details to sign in.' : 'Find your level. Build your skills. Level up with confidence.'}
              </p>
            </div>

            {/* Tab Selector */}
            <div className="flex bg-slate-100 dark:bg-surface-low rounded-xl p-1 shrink-0">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white dark:bg-paper text-slate-800 dark:text-ink shadow-sm'
                    : 'text-slate-500 dark:text-ink-muted hover:text-slate-700 dark:hover:text-ink'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white dark:bg-paper text-slate-800 dark:text-ink shadow-sm'
                    : 'text-slate-500 dark:text-ink-muted hover:text-slate-700 dark:hover:text-ink'
                }`}
              >
                Sign Up
              </button>
              {import.meta.env.DEV && (
                <button
                  type="button"
                  onClick={handleDemoAdminLogin}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold text-accent hover:bg-accent/5 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Sparkles size={11} />
                  Demo Admin
                </button>
              )}
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3 text-destructive text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleAuth}>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-muted uppercase tracking-normal px-1 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" />
                    Email Address
                  </label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full h-11 bg-background/50 backdrop-blur-sm border border-ink/5 rounded-xl px-4 focus:ring-2 focus:ring-accent/40 focus:border-accent/40 outline-none transition-all text-sm font-medium hover:border-ink/10"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-mono font-bold text-muted uppercase tracking-normal flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5" />
                      Password
                    </label>
                    {mode === 'login' && (
                      <button 
                        type="button" 
                        onClick={() => {
                          if (!email) {
                            setError('Please enter your email address first to reset your password.');
                            return;
                          }
                          supabase.auth.resetPasswordForEmail(email, {
                            redirectTo: `${window.location.origin}/reset-password`,
                          });
                          alert("If an account exists, a password reset email has been sent.");
                        }}
                        className="text-[10px] font-medium text-accent hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 bg-background/50 backdrop-blur-sm border border-ink/5 rounded-xl px-4 focus:ring-2 focus:ring-accent/40 focus:border-accent/40 outline-none transition-all text-sm font-medium hover:border-ink/10"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="group w-full h-11 bg-ink text-paper rounded-xl font-semibold text-sm shadow-md shadow-ink/15 hover:shadow-lg hover:shadow-ink/25 hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer"
              >
                {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
                {!loading && <LogIn className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />}
              </button>
            </form>

            {import.meta.env.DEV && (
              <button
                type="button"
                disabled={loading}
                onClick={handleDemoAdminLogin}
                className="w-full h-11 border border-accent/20 bg-accent/5 text-accent rounded-xl flex items-center justify-center gap-2 text-xs font-medium hover:bg-accent/10 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Continue as Demo Admin
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-ink/5"></div>
              </div>
              <div className="relative flex justify-center text-[9px] uppercase tracking-[0.2em] font-mono font-bold">
                <span className="bg-paper px-4 text-muted/60">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => handleSocialLogin('google')}
                className="h-11 bg-background/50 backdrop-blur-sm border border-ink/5 rounded-xl flex items-center justify-center gap-2 hover:bg-ink/5 hover:-translate-y-0.5 shadow-sm hover:shadow-md transition-all group cursor-pointer"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-3.5 h-3.5 grayscale group-hover:grayscale-0 transition-all" />
                <span className="text-[10px] font-bold text-ink uppercase tracking-normal">Google</span>
              </button>
              <button 
                onClick={() => handleSocialLogin('facebook')}
                className="h-11 bg-background/50 backdrop-blur-sm border border-ink/5 rounded-xl flex items-center justify-center gap-2 hover:bg-ink/5 hover:-translate-y-0.5 shadow-sm hover:shadow-md transition-all group cursor-pointer"
              >
                <Facebook className="w-3.5 h-3.5 text-[#1877F2]" />
                <span className="text-[10px] font-bold text-ink uppercase tracking-normal">Facebook</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};
