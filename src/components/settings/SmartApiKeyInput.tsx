import React, { useState, useEffect } from 'react';
import { KeyRound, Sparkles, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../../context/LanguageContext';
import { toast } from 'sonner';
import { supabase } from '../../db/supabase';

const authHeaders = async () => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
};

export const SmartApiKeyInput: React.FC = () => {
  const { t } = useLanguage();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'gemini' | 'groq' | 'unknown' | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const loadKeys = async () => {
      try {
        const { headers } = await authHeaders();
        const keysResponse = await fetch('/api/settings/ai-keys', { headers });
        const keysData = await keysResponse.json().catch(() => ({}));
        if (keysResponse.ok && keysData.keys && keysData.keys.length > 0) {
          setIsSaved(true);
        }
      } catch (err) {
        // Ignore
      }
    };
    loadKeys();
  }, []);

  const detectProvider = (key: string) => {
    if (!key) return null;
    if (key.startsWith('sk-proj-') || key.startsWith('sk-')) return 'openai';
    if (key.startsWith('sk-ant-')) return 'anthropic';
    if (key.startsWith('AIza')) return 'gemini';
    if (key.startsWith('gsk_')) return 'groq';
    return 'unknown';
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKey(val);
    setProvider(detectProvider(val));
    setIsSaved(false);
  };

  const handleSave = async () => {
    if (!apiKey) return;
    
    let detectedId = provider;
    if (detectedId === 'unknown' || !detectedId) {
      toast.error('Unrecognized API Key format');
      return;
    }

    try {
      const { headers } = await authHeaders();
      const response = await fetch('/api/settings/ai-keys', {
        method: 'POST',
        headers,
        body: JSON.stringify({ provider: detectedId, apiKey }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to save API key.');

      setIsSaved(true);
      toast.success(`${detectedId} API Key saved securely!`);
    } catch (error) {
      toast.error('Failed to save API key');
    }
  };

  const getProviderIcon = () => {
    switch (provider) {
      case 'openai': return <span className="font-bold text-emerald-500 text-xs">OpenAI Detected</span>;
      case 'anthropic': return <span className="font-bold text-orange-500 text-xs">Anthropic Detected</span>;
      case 'gemini': return <span className="font-bold text-blue-500 text-xs">Gemini Detected</span>;
      case 'groq': return <span className="font-bold text-red-500 text-xs">Groq Detected</span>;
      case 'unknown': return <span className="font-bold text-slate-400 text-xs">Unknown Provider</span>;
      default: return null;
    }
  };

  return (
    <div className="p-6 bg-paper border border-ink/5 rounded-3xl shadow-sm space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-ink">Bring Your Own Key (BYOK)</h3>
          <p className="text-xs text-muted">Unlock unlimited AI generations by adding your own API key.</p>
        </div>
      </div>

      <div className="relative">
        <div className={`flex items-center border-2 rounded-2xl transition-all duration-300 bg-background ${
          provider && provider !== 'unknown' ? 'border-accent/40 shadow-[0_0_15px_rgba(var(--accent-rgb),0.1)]' : 'border-ink/10 focus-within:border-accent'
        }`}>
          <div className="pl-4 text-muted">
            <Sparkles className={`w-5 h-5 ${provider && provider !== 'unknown' ? 'text-accent animate-pulse' : ''}`} />
          </div>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={handleKeyChange}
            placeholder="Paste your API key (sk-... or AIza...)"
            className="flex-1 px-3 py-4 bg-transparent outline-none text-sm font-mono text-ink placeholder:text-muted/50"
          />
          <button 
            type="button"
            onClick={() => setShowKey(!showKey)}
            aria-label={showKey ? 'Hide API key' : 'Show API key'}
            className="px-3 text-muted hover:text-ink transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 rounded-lg"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        
        <AnimatePresence>
          {provider && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 -bottom-6 flex items-center gap-2"
            >
              {getProviderIcon()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-1.5 text-[10px] text-muted font-medium">
          <Lock className="w-3 h-3" />
          Keys are encrypted and stored locally in your browser.
        </div>
        <button
          onClick={handleSave}
          disabled={!apiKey || provider === 'unknown' || isSaved}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            isSaved 
              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
              : 'bg-ink text-paper hover:bg-accent hover:text-white disabled:opacity-50 disabled:hover:bg-ink'
          }`}
        >
          {isSaved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Saved
            </>
          ) : 'Save Key'}
        </button>
      </div>
    </div>
  );
};
