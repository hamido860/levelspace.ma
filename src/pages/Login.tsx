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
      <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-slate-950 p-2 font-sans sm:p-4">
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
          className="relative z-10 grid w-full max-w-[58rem] overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/30 md:min-h-[min(560px,calc(100dvh-2rem))] md:grid-cols-[0.92fr_1.08fr]"
        >
          {/* Left Panel: Premium Branding & Info showcase (Hidden on narrow mobile) */}
          <aside className="relative hidden overflow-hidden bg-slate-950 p-7 text-white md:flex md:flex-col md:justify-center">
            <div className="absolute -right-20 -top-16 h-64 w-64 rounded-full bg-accent/30 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-14 h-56 w-56 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />
            
            <div className="relative">
              <div className="mb-7 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/30">
                  <Sparkles className="h-5 w-5" />
                </div>
                <span className="font-display text-2xl font-bold tracking-tight">Levelspace</span>
              </div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-blue-300">Authentication Command Center</p>
              <h2 className="max-w-sm text-[2rem] font-bold leading-tight">Content is everywhere. Guidance is not.</h2>
              <p className="mt-4 max-w-xs text-sm font-medium leading-relaxed text-white/60">
                Unlock your personalized learning space. Track focus, master subjects, and level up with AI-guided curriculums.
              </p>
            </div>

            <div className="relative mt-7 hidden space-y-2.5 xl:block">
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
          <div className="flex flex-col justify-center bg-slate-950 p-5 text-white sm:p-7 md:p-8">
            <div className="mx-auto w-full max-w-[25rem]">
            <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-lg shadow-accent/25">
                  <Sparkles className="h-5 w-5" />
                </div>
                <span className="font-display text-lg font-bold tracking-tight text-white">Levelspace</span>
              </div>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
                Secure
              </span>
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {mode === 'login' ? 'Welcome back' : 'Create your space'}
              </h2>
              <p className="text-sm font-medium text-slate-400">
                {mode === 'login' ? 'Please enter your details to sign in.' : 'Find your level. Build your skills. Level up with confidence.'}
              </p>
            </div>

            {/* Tab Selector */}
            <div className="flex shrink-0 rounded-xl bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-2.5 text-xs text-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <form className="space-y-3" onSubmit={handleAuth}>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-300">
                    <Mail className="w-4 h-4" />
                    Email Address
                  </label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-medium text-white outline-none transition-all placeholder:text-slate-500 hover:border-white/20 focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-300">
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
                        className="text-xs font-semibold text-accent hover:underline"
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
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-medium text-white outline-none transition-all placeholder:text-slate-500 hover:border-white/20 focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="group flex h-11 w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-white text-sm font-bold text-slate-950 shadow-md shadow-black/20 transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
                {!loading && <LogIn className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />}
              </button>
            </form>

            <button
              type="button"
              disabled={loading}
              onClick={handleDemoAdminLogin}
              className="flex h-11 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-accent/30 bg-accent/10 text-sm font-semibold text-blue-200 transition-all hover:bg-accent/20 disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5" />
              Continue as Demo Admin
              <ArrowRight className="w-5 h-5" />
            </button>

            <div className="relative py-0.5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-[0.18em]">
                <span className="bg-slate-950 px-4 text-slate-500">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button 
                onClick={() => handleSocialLogin('google')}
                className="group flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 transition-all hover:-translate-y-0.5 hover:bg-white/10"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all" />
                <span className="text-xs font-bold uppercase tracking-normal text-white">Google</span>
              </button>
              <button 
                onClick={() => handleSocialLogin('facebook')}
                className="group flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 transition-all hover:-translate-y-0.5 hover:bg-white/10"
              >
                <Facebook className="w-5 h-5 text-[#1877F2]" />
                <span className="text-xs font-bold uppercase tracking-normal text-white">Facebook</span>
              </button>
            </div>
            </div>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};
