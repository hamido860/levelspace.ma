import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { supabase } from '../db/supabase';
import { useAuth } from '../context/AuthContext';
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

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { signInAsDemoAdmin } = useAuth() as any;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/dashboard');
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

  const handleDemoAdmin = async () => {
    setLoading(true);
    try {
      await signInAsDemoAdmin();
      navigate('/admin');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
      if (error) throw error;
    } catch (err: any) {
      if (err.message.includes('not enabled')) {
        setError(`The ${provider} login provider is not enabled. Please enable it in your Supabase Dashboard under Authentication > Providers.`);
      } else {
        setError(err.message);
      }
    }
  };

  return (
    <Layout hideSidebar>
      <SEO title={mode === 'login' ? "Login" : "Sign Up"} />
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4 md:p-8 font-sans relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_0%_0%,_var(--tw-gradient-stops))] from-accent/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_100%_100%,_var(--tw-gradient-stops))] from-accent/5 via-transparent to-transparent pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md bg-paper rounded-[2rem] shadow-2xl shadow-ink/5 border border-ink/5 overflow-hidden lg:scale-[0.70] lg:origin-center"
        >
          {/* Top Branding Bar */}
          <div className="bg-accent p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-paper/20 backdrop-blur-md rounded-lg flex items-center justify-center border border-paper/30">
                <BookOpen className="text-paper w-5 h-5" />
              </div>
              <span className="text-paper font-display font-bold tracking-tight">LevelSpace</span>
            </div>
            <div className="text-[10px] font-mono font-bold text-paper/60 uppercase tracking-widest">
              MMXXIV
            </div>
          </div>

          <div className="p-8 md:p-10 space-y-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-serif font-medium tracking-tight text-ink">
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="text-muted text-sm font-light">
                {mode === 'login' ? 'Please enter your details to sign in.' : 'Join our community of curated learners.'}
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
                  <label className="text-[10px] font-mono font-bold text-muted uppercase tracking-widest px-1 flex items-center gap-2">
                    <Mail className="w-3 h-3" />
                    Email Address
                  </label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full h-11 bg-background border border-ink/5 rounded-xl px-4 focus:ring-1 focus:ring-accent/30 outline-none transition-all text-sm font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-mono font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                      <Lock className="w-3 h-3" />
                      Password
                    </label>
                  </div>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 bg-background border border-ink/5 rounded-xl px-4 focus:ring-1 focus:ring-accent/30 outline-none transition-all text-sm font-medium"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="group w-full h-12 bg-ink text-paper rounded-full font-medium text-base shadow-lg shadow-ink/10 hover:bg-accent active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
                {!loading && <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              </button>
            </form>

            <div className="relative py-2">
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
                className="h-11 bg-background border border-ink/5 rounded-full flex items-center justify-center gap-2 hover:bg-ink/5 transition-all group"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-3.5 h-3.5 grayscale group-hover:grayscale-0 transition-all" />
                <span className="text-[10px] font-bold text-ink uppercase tracking-widest">Google</span>
              </button>
              <button 
                onClick={() => handleSocialLogin('facebook')}
                className="h-11 bg-background border border-ink/5 rounded-full flex items-center justify-center gap-2 hover:bg-ink/5 transition-all group"
              >
                <Facebook className="w-3.5 h-3.5 text-[#1877F2]" />
                <span className="text-[10px] font-bold text-ink uppercase tracking-widest">Facebook</span>
              </button>
            </div>

            <p className="text-center text-[11px] text-muted font-medium pt-2">
              {mode === 'login' ? "Don't have an account?" : "Already have an account?"} 
              <button 
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} 
                className="font-bold text-accent hover:underline flex items-center gap-1 mx-auto mt-1 uppercase tracking-widest text-[9px]"
              >
                {mode === 'login' ? 'Sign up for free' : 'Sign in instead'}
                <ArrowRight className="w-3 h-3" />
              </button>
            </p>

            <div className="pt-4 border-t border-ink/5 flex justify-center">
               <button
                 onClick={handleDemoAdmin}
                 disabled={loading}
                 className="text-[9px] uppercase tracking-widest font-mono font-bold text-accent/60 hover:text-accent transition-colors"
               >
                 Sign In As Demo Admin
               </button>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};
