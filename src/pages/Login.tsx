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
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#f7f7f6] p-3 font-sans relative overflow-hidden">
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
          className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-black/5 bg-white shadow-2xl shadow-black/5 md:min-h-[min(690px,calc(100dvh-1.5rem))] md:grid-cols-[0.78fr_1.22fr]"
        >
          {/* Left Panel: Premium Branding & Info showcase (Hidden on narrow mobile) */}
          <aside className="relative hidden overflow-hidden bg-slate-950 p-9 text-white md:flex md:flex-col md:justify-between">
            <div className="absolute -right-20 -top-16 h-64 w-64 rounded-full bg-accent/30 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-14 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />
            
            <div className="relative">
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/30">
                  <Sparkles className="h-6 w-6" />
                </div>
                <span className="font-display text-2xl font-bold tracking-tight">Levelspace</span>
              </div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-blue-300">Authentication Command Center</p>
              <h2 className="max-w-sm text-3xl font-bold leading-tight">Content is everywhere. Guidance is not.</h2>
              <p className="mt-4 max-w-xs text-sm font-medium leading-relaxed text-white/60">
                Unlock your personalized learning space. Track focus, master subjects, and level up with AI-guided curriculums.
              </p>
            </div>

            <div className="relative mt-7 space-y-2.5">
              {[
                ['01', 'Curriculum-aware classrooms'],
                ['02', 'AI-guided modular lessons'],
                ['03', 'Deep focus & mastery metrics'],
              ].map(([number, label]) => (
                <div key={number} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="text-sm font-bold tracking-widest text-blue-300">{number}</span>
                  <span className="text-sm font-semibold text-white/80">{label}</span>
                </div>
              ))}
            </div>
          </aside>

          {/* Right Panel: Clean form selection & inputs */}
          <div className="flex flex-col justify-center bg-white p-6 text-slate-950 sm:p-8 md:p-10">
            <div className="mx-auto flex w-full max-w-[34rem] flex-col gap-5">
            <div className="space-y-2.5">
              <h2 className="text-4xl font-bold tracking-tight text-slate-950">
                {mode === 'login' ? 'Welcome back' : 'Create your space'}
              </h2>
              <p className="text-base font-medium text-slate-500">
                {mode === 'login' ? 'Please enter your details to sign in.' : 'Find your level. Build your skills. Level up with confidence.'}
              </p>
            </div>

            {/* Tab Selector */}
            <div className="flex shrink-0 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={handleDemoAdminLogin}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-accent transition-all hover:bg-accent/5"
              >
                <Sparkles size={17} />
                Demo Admin
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleAuth}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-mono font-bold text-slate-500 uppercase tracking-normal px-1 flex items-center gap-3">
                    <Mail className="w-4 h-4" />
                    Email Address
                  </label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="h-13 w-full rounded-2xl border border-slate-200 bg-white px-5 text-base font-medium text-slate-950 outline-none transition-all placeholder:text-slate-500 hover:border-slate-300 focus:border-accent/40 focus:ring-2 focus:ring-accent/30"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-sm font-mono font-bold text-slate-500 uppercase tracking-normal flex items-center gap-3">
                      <Lock className="w-4 h-4" />
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
                        className="text-sm font-semibold text-accent hover:underline"
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
                    className="h-13 w-full rounded-2xl border border-slate-200 bg-white px-5 text-base font-medium text-slate-950 outline-none transition-all placeholder:text-slate-500 hover:border-slate-300 focus:border-accent/40 focus:ring-2 focus:ring-accent/30"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="group flex h-13 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-slate-950 text-base font-semibold text-white shadow-md shadow-slate-950/15 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-950/25 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
                {!loading && <LogIn className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />}
              </button>
            </form>

            <button
              type="button"
              disabled={loading}
              onClick={handleDemoAdminLogin}
              className="flex h-13 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 text-sm font-semibold text-accent transition-all hover:bg-accent/10 disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5" />
              Continue as Demo Admin
              <ArrowRight className="w-5 h-5" />
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-ink/5"></div>
              </div>
              <div className="relative flex justify-center text-xs font-bold uppercase tracking-[0.22em]">
                <span className="bg-white px-6 text-slate-400">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => handleSocialLogin('google')}
                className="group flex h-12 cursor-pointer items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all" />
                <span className="text-sm font-bold uppercase tracking-normal text-slate-950">Google</span>
              </button>
              <button 
                onClick={() => handleSocialLogin('facebook')}
                className="group flex h-12 cursor-pointer items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
              >
                <Facebook className="w-5 h-5 text-[#1877F2]" />
                <span className="text-sm font-bold uppercase tracking-normal text-slate-950">Facebook</span>
              </button>
            </div>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};
