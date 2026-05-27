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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: email.split('@')[0],
            }
          }
        });
        if (error) throw error;
        alert('Check your email for the confirmation link!');
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
          className="w-full max-w-md bg-paper/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-ink/5 border border-white/20 overflow-hidden relative z-10 group"
        >
          {/* Top Branding Bar */}
          <div className="bg-accent p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-paper/20  rounded-lg flex items-center justify-center border border-paper/30">
                <BookOpen className="text-paper w-5 h-5" />
              </div>
              <span className="text-paper font-display font-bold tracking-tight">LevelSpace</span>
            </div>
            <div className="text-[10px] font-mono font-bold text-paper/60 uppercase tracking-normal">
              MMXXIV
            </div>
          </div>

          <div className="p-8 md:p-10 space-y-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-serif font-medium tracking-tight text-ink">
                {mode === 'login' ? 'Welcome back' : 'Content is everywhere. Guidance is not.'}
              </h2>
              <p className="text-muted text-sm font-light">
                {mode === 'login' ? 'Please enter your details to sign in.' : 'Find your level. Build your skills. Level up with confidence.'}
              </p>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3 text-destructive text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <form className="space-y-6" onSubmit={handleAuth}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold text-muted uppercase tracking-normal px-1 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Address
                  </label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full h-12 bg-background/50 backdrop-blur-sm border border-ink/5 rounded-xl px-4 focus:ring-2 focus:ring-accent/40 focus:border-accent/40 outline-none transition-all text-base font-medium hover:border-ink/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-xs font-mono font-bold text-muted uppercase tracking-normal flex items-center gap-2">
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
                        className="text-xs font-medium text-accent hover:underline"
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
                    className="w-full h-12 bg-background/50 backdrop-blur-sm border border-ink/5 rounded-xl px-4 focus:ring-2 focus:ring-accent/40 focus:border-accent/40 outline-none transition-all text-base font-medium hover:border-ink/10"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="group w-full h-12 bg-ink text-paper rounded-xl font-semibold text-base shadow-lg shadow-ink/20 hover:shadow-xl hover:shadow-ink/30 hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
                {!loading && <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              </button>
            </form>

            {import.meta.env.DEV && (
              <button
                type="button"
                disabled={loading}
                onClick={handleDemoAdminLogin}
                className="w-full h-12 border border-accent/20 bg-accent/5 text-accent rounded-xl flex items-center justify-center gap-2 text-sm font-medium hover:bg-accent/10 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                Continue as Demo Admin
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-ink/5"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] font-mono font-bold">
                <span className="bg-paper px-4 text-muted/60">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => handleSocialLogin('google')}
                className="h-12 bg-background/50 backdrop-blur-sm border border-ink/5 rounded-xl flex items-center justify-center gap-2 hover:bg-ink/5 hover:-translate-y-0.5 shadow-sm hover:shadow-md transition-all group"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all" />
                <span className="text-xs font-bold text-ink uppercase tracking-normal">Google</span>
              </button>
              <button 
                onClick={() => handleSocialLogin('facebook')}
                className="h-12 bg-background/50 backdrop-blur-sm border border-ink/5 rounded-xl flex items-center justify-center gap-2 hover:bg-ink/5 hover:-translate-y-0.5 shadow-sm hover:shadow-md transition-all group"
              >
                <Facebook className="w-4 h-4 text-[#1877F2]" />
                <span className="text-xs font-bold text-ink uppercase tracking-normal">Facebook</span>
              </button>
            </div>

            <p className="text-center text-[11px] text-muted font-medium pt-2">
              {mode === 'login' ? "Don't have an account?" : "Already have an account?"} 
              <button 
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} 
                className="font-bold text-accent hover:underline flex items-center gap-1 mx-auto mt-1 uppercase tracking-normal text-[9px]"
              >
                {mode === 'login' ? 'Sign up for free' : 'Sign in instead'}
                <ArrowRight className="w-3 h-3" />
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};
