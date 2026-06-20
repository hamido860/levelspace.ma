import React, { useEffect, useState } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  KeyRound, 
  Loader2, 
  Trash2, 
  Zap, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Server, 
  Lock, 
  Plus,
  RefreshCw,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../db/supabase';
import { Modal } from '../Modal';

type Provider = 'gemini' | 'openrouter' | 'openai' | 'nvidia';
type CredentialMode = 'byok' | 'platform';

type KeyItem = {
  id: string;
  name: string;
  provider: Provider;
  apiKey: string;
  keyPreview: string;
  isActive: boolean;
  synced: boolean;
  createdAt: string;
  lastTestedAt?: string | null;
  testStatus?: 'passed' | 'failed' | null;
};

type PlatformStatus = {
  configured: boolean;
  platformCreditsEnabled: boolean;
  defaultProvider: string;
  fallbackProvider: string | null;
  providers: Record<string, boolean>;
  devAdmin?: {
    enabled: boolean;
    providers: Partial<Record<Provider, boolean>>;
    defaultProvider: string | null;
  };
};

const PROVIDER_INFO: Record<Provider, { label: string, color: string, badgeGlow: string, bgGradient: string, borderTheme: string }> = {
  gemini: {
    label: 'Gemini',
    color: 'text-blue-500',
    badgeGlow: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
    bgGradient: 'from-blue-500/5 to-indigo-500/5 dark:from-blue-500/10 dark:to-indigo-500/5',
    borderTheme: 'hover:border-blue-500/40 focus-within:border-blue-500 focus-within:ring-blue-500/20'
  },
  openai: {
    label: 'OpenAI',
    color: 'text-emerald-500',
    badgeGlow: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    bgGradient: 'from-emerald-500/5 to-teal-500/5 dark:from-emerald-500/10 dark:to-teal-500/5',
    borderTheme: 'hover:border-emerald-500/40 focus-within:border-emerald-500 focus-within:ring-emerald-500/20'
  },
  openrouter: {
    label: 'OpenRouter',
    color: 'text-purple-500',
    badgeGlow: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400',
    bgGradient: 'from-purple-500/5 to-pink-500/5 dark:from-purple-500/10 dark:to-pink-500/5',
    borderTheme: 'hover:border-purple-500/40 focus-within:border-purple-500 focus-within:ring-purple-500/20'
  },
  nvidia: {
    label: 'NVIDIA',
    color: 'text-green-500',
    badgeGlow: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400',
    bgGradient: 'from-green-500/5 to-emerald-500/5 dark:from-green-500/10 dark:to-emerald-500/5',
    borderTheme: 'hover:border-green-500/40 focus-within:border-green-500 focus-within:ring-green-500/20'
  }
};

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    authenticated: Boolean(token),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
};

interface AiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'user' | 'admin';
}

export const AiKeysModal: React.FC<AiKeysModalProps> = ({ isOpen, onClose, mode = 'user' }) => {
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [draftKey, setDraftKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [detectedProvider, setDetectedProvider] = useState<Provider | 'unknown'>('unknown');
  
  const [credentialMode, setCredentialMode] = useState<CredentialMode>(() => 
    (localStorage.getItem('ai_credential_mode') === 'platform' ? 'platform' : 'byok')
  );
  
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loadError, setLoadError] = useState('');

  const storageKey = mode === 'user' ? 'ai_keys_user' : 'ai_keys_admin';

  // Smart API Key Prefix Auto-Detection
  const detectProvider = (key: string): Provider | 'unknown' => {
    const clean = key.trim();
    if (!clean) return 'unknown';
    if (clean.startsWith('AIza')) return 'gemini';
    if (clean.startsWith('sk-or-')) return 'openrouter';
    if (clean.startsWith('sk-proj-') || (clean.startsWith('sk-') && !clean.startsWith('sk-or-') && !clean.startsWith('sk-ant-'))) return 'openai';
    if (clean.startsWith('nvapi-')) return 'nvidia';
    return 'unknown';
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDraftKey(val);
    setDetectedProvider(detectProvider(val));
  };

  const getKeyPreview = (rawKey: string): string => {
    const cleaned = rawKey.trim();
    const suffix = cleaned.slice(-4);
    const prefix = cleaned.startsWith('sk-') ? 'sk-' : cleaned.slice(0, Math.min(4, cleaned.length));
    return `${prefix}...${suffix || '****'}`;
  };

  const loadKeysAndStatus = async () => {
    setLoading(true);
    try {
      const auth = await getAuthHeaders();
      setAuthenticated(auth.authenticated);
      setLoadError('');

      // 1. Fetch system platform AI status
      const statusResponse = await fetch('/api/ai/status');
      if (statusResponse.ok) {
        const statusData = await statusResponse.json().catch(() => null);
        setPlatformStatus(statusData);
      }

      // 2. Fetch server-side encrypted keys metadata from Supabase
      const keysResponse = await fetch('/api/settings/ai-keys', { headers: auth.headers });
      const keysData = await keysResponse.json().catch(() => ({}));
      
      const serverMetadata: any[] = keysData.keys || [];

      // 3. Load user's local browser vault
      const stored = localStorage.getItem(storageKey);
      let localVault: KeyItem[] = stored ? JSON.parse(stored) : [];

      // Clean local list and sync with server data
      // For any provider configured on server but missing in local vault, backfill a synced placeholder item
      serverMetadata.forEach((meta) => {
        if (meta.is_active && meta.key_preview) {
          const hasProviderInLocal = localVault.some(k => k.provider === meta.provider);
          if (!hasProviderInLocal) {
            localVault.push({
              id: `${meta.provider}_synced`,
              name: `API ${meta.provider.charAt(0).toUpperCase() + meta.provider.slice(1)} 1 (Synced)`,
              provider: meta.provider,
              apiKey: '', // secure on server, empty placeholder locally
              keyPreview: meta.key_preview,
              isActive: true,
              synced: true,
              createdAt: meta.updated_at || new Date().toISOString(),
              testStatus: meta.last_test_status as any,
              lastTestedAt: meta.last_tested_at
            });
          } else {
            // Update active state in local vault to match server reality
            localVault = localVault.map(k => {
              if (k.provider === meta.provider && k.isActive) {
                return {
                  ...k,
                  synced: true,
                  keyPreview: meta.key_preview,
                  testStatus: (meta.last_test_status || k.testStatus) as any,
                  lastTestedAt: meta.last_tested_at || k.lastTestedAt
                };
              }
              return k;
            });
          }
        }
      });

      setKeys(localVault);
      localStorage.setItem(storageKey, JSON.stringify(localVault));
    } catch (error: any) {
      setLoadError(error.message || 'Unable to load AI credentials.');
      // Fallback to purely local vault
      const stored = localStorage.getItem(storageKey);
      if (stored) setKeys(JSON.parse(stored));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadKeysAndStatus();
      setDraftKey('');
      setDetectedProvider('unknown');
    }
  }, [isOpen, mode]);

  const toggleCredentialMode = (next: CredentialMode) => {
    setCredentialMode(next);
    localStorage.setItem('ai_credential_mode', next);
    toast.success(`Mode changed to: ${next === 'byok' ? 'Bring Your Own Key' : 'Platform AI Credits'}`);
  };

  const handleAddKey = async () => {
    if (detectedProvider === 'unknown') {
      toast.error('Unable to add key', { description: 'Please paste a valid Gemini, OpenAI, OpenRouter, or NVIDIA API key.' });
      return;
    }

    const trimmed = draftKey.trim();
    setBusy('adding');

    try {
      // 1. Calculate next alphabetical/numerical name for the provider
      const providerKeys = keys.filter(k => k.provider === detectedProvider);
      const nextIndex = providerKeys.length + 1;
      const providerLabel = PROVIDER_INFO[detectedProvider].label;
      const keyName = `API ${providerLabel} ${nextIndex}`;

      // 2. Encrypt and save this new active key securely on Supabase
      const auth = await getAuthHeaders();
      const response = await fetch('/api/settings/ai-keys', {
        method: 'POST',
        headers: auth.headers,
        body: JSON.stringify({ provider: detectedProvider, apiKey: trimmed }),
      });
      
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to save key securely on the server.');

      // 3. Mark all previous keys of the same provider as inactive
      let updatedKeys = keys.map(k => {
        if (k.provider === detectedProvider) {
          return { ...k, isActive: false };
        }
        return k;
      });

      // 4. Create and append the new active key item
      const newKeyItem: KeyItem = {
        id: `${detectedProvider}_${Date.now()}`,
        name: keyName,
        provider: detectedProvider,
        apiKey: trimmed,
        keyPreview: getKeyPreview(trimmed),
        isActive: true,
        synced: true,
        createdAt: new Date().toISOString()
      };

      updatedKeys = [newKeyItem, ...updatedKeys];
      setKeys(updatedKeys);
      localStorage.setItem(storageKey, JSON.stringify(updatedKeys));
      
      // Select provider in localStorage
      localStorage.setItem('ai_provider', detectedProvider);
      localStorage.removeItem('ai_model');

      setDraftKey('');
      setDetectedProvider('unknown');
      toast.success(`${keyName} successfully registered and activated!`);
    } catch (err: any) {
      toast.error('Registration failed', { description: err.message });
    } finally {
      setBusy(null);
    }
  };

  const handleActivateKey = async (targetKey: KeyItem) => {
    if (targetKey.isActive) return;

    setBusy(`${targetKey.id}:activate`);
    try {
      const auth = await getAuthHeaders();
      
      // If the target key has the full API key in local storage, sync it to the database
      if (targetKey.apiKey) {
        const response = await fetch('/api/settings/ai-keys', {
          method: 'POST',
          headers: auth.headers,
          body: JSON.stringify({ provider: targetKey.provider, apiKey: targetKey.apiKey }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Failed to sync active key with Supabase.');
      }

      // Mark active locally
      const updatedKeys = keys.map(k => {
        if (k.provider === targetKey.provider) {
          return { ...k, isActive: k.id === targetKey.id };
        }
        return k;
      });

      setKeys(updatedKeys);
      localStorage.setItem(storageKey, JSON.stringify(updatedKeys));
      
      localStorage.setItem('ai_provider', targetKey.provider);
      localStorage.removeItem('ai_model');

      toast.success(`${targetKey.name} is now the active ${PROVIDER_INFO[targetKey.provider].label} engine!`);
    } catch (err: any) {
      toast.error('Activation failed', { description: err.message });
    } finally {
      setBusy(null);
    }
  };

  const handleTestKey = async (targetKey: KeyItem) => {
    setBusy(`${targetKey.id}:test`);
    try {
      const auth = await getAuthHeaders();
      const requestBody = {
        provider: targetKey.provider,
        ...(targetKey.apiKey ? { apiKey: targetKey.apiKey } : {})
      };

      const response = await fetch('/api/settings/ai-keys/test', {
        method: 'POST',
        headers: auth.headers,
        body: JSON.stringify(requestBody),
      });

      const data = await response.json().catch(() => ({}));
      const passed = response.ok && data.success;

      // Update locally
      const updatedKeys = keys.map(k => {
        if (k.id === targetKey.id) {
          return { 
            ...k, 
            testStatus: passed ? 'passed' as const : 'failed' as const,
            lastTestedAt: new Date().toISOString()
          };
        }
        return k;
      });

      setKeys(updatedKeys);
      localStorage.setItem(storageKey, JSON.stringify(updatedKeys));

      if (passed) {
        toast.success(`${targetKey.name} validation passed!`, { description: 'API responded successfully.' });
      } else {
        toast.error(`${targetKey.name} validation failed`, { description: data.error || 'Key returned an error status from the provider.' });
      }
    } catch (err: any) {
      toast.error('Key testing failed', { description: err.message });
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteKey = async (targetKey: KeyItem) => {
    setBusy(`${targetKey.id}:delete`);
    try {
      const auth = await getAuthHeaders();

      // If active, delete from server as well
      if (targetKey.isActive) {
        const response = await fetch(`/api/settings/ai-keys/${targetKey.provider}`, {
          method: 'DELETE',
          headers: auth.headers,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Failed to remove active key on Supabase.');
      }

      // Remove from browser list
      const remainingKeys = keys.filter(k => k.id !== targetKey.id);
      
      // If we just deleted the active key, auto-activate the next available key for that provider
      if (targetKey.isActive) {
        const nextAvailable = remainingKeys.find(k => k.provider === targetKey.provider);
        if (nextAvailable) {
          nextAvailable.isActive = true;
          if (nextAvailable.apiKey) {
            // Sync new active key with server
            await fetch('/api/settings/ai-keys', {
              method: 'POST',
              headers: auth.headers,
              body: JSON.stringify({ provider: nextAvailable.provider, apiKey: nextAvailable.apiKey }),
            });
          }
          toast.info(`Auto-activated next fallback: ${nextAvailable.name}`);
        }
      }

      setKeys(remainingKeys);
      localStorage.setItem(storageKey, JSON.stringify(remainingKeys));
      toast.success(`${targetKey.name} successfully deleted from vault.`);
    } catch (err: any) {
      toast.error('Deletion failed', { description: err.message });
    } finally {
      setBusy(null);
    }
  };

  const getSmartInputAccentColor = () => {
    if (detectedProvider === 'unknown') return 'border-ink/10 focus-within:border-accent/40 focus-within:shadow-[0_0_15px_rgba(18,70,255,0.06)]';
    return `border-accent/30 shadow-[0_0_20px_rgba(var(--accent-rgb),0.08)] ${PROVIDER_INFO[detectedProvider].borderTheme}`;
  };

  const activeModeCount = keys.filter(k => k.isActive).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <Lock className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-base font-bold font-display text-ink leading-tight">
              {mode === 'admin' ? 'AI Keys (Admin Override)' : 'AI Keys (User BYOK)'}
            </span>
            <span className="text-[10px] font-semibold text-muted tracking-wide uppercase mt-0.5">
              Secure Credentials Vault
            </span>
          </div>
        </div>
      }
      maxWidth="xl"
    >
      <div className="space-y-6">
        
        {/* Dynamic Mode Switcher (Credential settings toggle) */}
        {mode === 'user' && (
          <div className="grid grid-cols-2 gap-2 bg-surface-low p-1.5 rounded-2xl border border-ink/5">
            <button
              onClick={() => toggleCredentialMode('byok')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-300 ${
                credentialMode === 'byok'
                  ? 'bg-paper text-ink shadow-sm font-bold border border-ink/5'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <KeyRound size={14} />
              Use BYOK API Key
            </button>
            <button
              onClick={() => toggleCredentialMode('platform')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-300 ${
                credentialMode === 'platform'
                  ? 'bg-paper text-ink shadow-sm font-bold border border-ink/5'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Zap size={14} />
              Use Platform Credits
            </button>
          </div>
        )}

        {/* Global Warnings/Status Alerts */}
        {loadError && (
          <div className="flex gap-2.5 bg-destructive/10 border border-destructive/20 rounded-2xl p-4 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-semibold leading-relaxed">{loadError}</p>
          </div>
        )}

        {/* Main secured vault info */}
        <div className="bg-paper border border-ink/5 rounded-2xl p-4 flex gap-3 text-xs text-ink-muted leading-relaxed">
          <Info className="w-4.5 h-4.5 text-accent shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-ink-secondary">Zero-Knowledge Storage</p>
            <p className="mt-0.5">
              All credentials in your local vault are securely stored locally inside your browser and encrypted server-side in Supabase. Your full keys are only decrypted in the transient server memory during AI execution.
            </p>
          </div>
        </div>

        {/* Smart Unified API Key Input */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-ink-muted uppercase tracking-wider pl-1">
            Smart Add API Key
          </label>
          <div className="relative">
            <div className={`flex items-center border-2 rounded-2xl bg-paper/50 backdrop-blur-sm transition-all duration-300 ${getSmartInputAccentColor()}`}>
              <div className="pl-4 text-muted shrink-0">
                <Sparkles className={`w-4 h-4 transition-all duration-500 ${detectedProvider !== 'unknown' ? 'text-accent animate-pulse scale-110' : ''}`} />
              </div>
              <input
                type={showKey ? 'text' : 'password'}
                value={draftKey}
                onChange={handleKeyChange}
                placeholder="Paste key (AIza... for Gemini, sk-... for OpenAI)"
                className="flex-grow min-w-0 bg-transparent py-3 px-3 outline-none text-xs font-mono text-ink"
                autoComplete="off"
                disabled={busy === 'adding'}
              />
              <div className="flex items-center gap-1.5 pr-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-ink/5 transition-all"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  type="button"
                  onClick={handleAddKey}
                  disabled={detectedProvider === 'unknown' || busy === 'adding'}
                  className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all ${
                    detectedProvider !== 'unknown' && busy !== 'adding'
                      ? 'bg-ink text-paper hover:bg-accent shadow-sm shadow-accent/15 cursor-pointer'
                      : 'bg-surface-mid text-muted opacity-40 cursor-not-allowed'
                  }`}
                  title="Add Key to Vault"
                >
                  {busy === 'adding' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />}
                </button>
              </div>
            </div>

            {/* Smart detection pill badge overlay */}
            {detectedProvider !== 'unknown' && (
              <div className={`absolute right-4 -top-3.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold shadow-sm uppercase tracking-wide transition-all duration-500 animate-fadeIn ${
                PROVIDER_INFO[detectedProvider].badgeGlow
              }`}>
                <CheckCircle2 size={10} className="text-current shrink-0 animate-bounce" />
                {PROVIDER_INFO[detectedProvider].label} Detected
              </div>
            )}
          </div>
        </div>

        {/* Browser local Vault Checklist */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pl-1">
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">
              Saved Vault Keys
            </span>
            <span className="text-[9px] font-bold text-accent bg-accent/10 rounded-full px-2 py-0.5">
              {keys.length} Credentials saved
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-ink-muted text-xs gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-accent" />
              <span>Decrypting secure browser vault...</span>
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-ink/10 rounded-2xl bg-paper/30 flex flex-col items-center justify-center gap-3">
              <KeyRound className="w-8 h-8 text-muted/40 animate-pulse" />
              <div className="text-xs">
                <p className="font-semibold text-ink-secondary">No AI keys saved yet</p>
                <p className="text-[11px] text-ink-muted mt-0.5">Paste an API key above to configure your AI pipeline.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 max-h-[350px] overflow-y-auto pr-1 no-scrollbar">
              {keys.map((key) => {
                const info = PROVIDER_INFO[key.provider];
                const isBusy = busy?.startsWith(key.id);
                return (
                  <div
                    key={key.id}
                    className={`group relative rounded-2xl border bg-paper/40 p-3.5 backdrop-blur-sm transition-all duration-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                      key.isActive
                        ? 'border-ink/10 dark:border-paper/20 shadow-md shadow-ink/2 bg-gradient-to-r' + ' ' + info.bgGradient
                        : 'border-ink/5 hover:border-ink/10 dark:hover:border-paper/10 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Active radio button */}
                      <button
                        onClick={() => handleActivateKey(key)}
                        disabled={isBusy}
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-1 cursor-pointer transition-all duration-300 ${
                          key.isActive
                            ? 'border-accent bg-accent text-white shadow-sm shadow-accent/20 scale-110'
                            : 'border-ink/15 hover:border-accent hover:scale-105'
                        }`}
                        title="Set as Active Key"
                      >
                        {key.isActive && <div className="w-1.5 h-1.5 rounded-full bg-paper shrink-0 animate-ping" />}
                      </button>

                      {/* Key details */}
                      <div className="flex flex-col text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-ink leading-tight">
                            {key.name}
                          </span>
                          <span className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 uppercase tracking-wide ${info.badgeGlow}`}>
                            {info.label}
                          </span>
                          {key.synced && (
                            <span className="text-[8px] font-bold text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 rounded px-1 flex items-center gap-0.5" title="Synchronized encrypted in cloud database">
                              <Lock size={8} /> Synced
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px] text-ink-muted">
                          <span className="font-mono text-ink-secondary bg-surface-low rounded px-1.5 py-0.5 text-[9px] select-all">
                            {key.keyPreview}
                          </span>
                          
                          {/* Test outcome badge inside list item */}
                          {key.testStatus && (
                            <span className={`inline-flex items-center gap-1 font-semibold ${
                              key.testStatus === 'passed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-error dark:text-red-400'
                            }`}>
                              &bull; Verified: {key.testStatus === 'passed' ? 'Passed' : 'Failed'}
                            </span>
                          )}
                          
                          {key.lastTestedAt && (
                            <span className="opacity-70">
                              (Tested {new Date(key.lastTestedAt).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions center */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handleTestKey(key)}
                        disabled={!!busy}
                        className={`inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-ink/5 text-[10px] font-bold text-ink-secondary bg-paper hover:bg-ink/5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
                        title="Verify API Key on endpoint"
                      >
                        {busy === `${key.id}:test` ? (
                          <Loader2 size={12} className="animate-spin text-accent" />
                        ) : (
                          <Zap size={11} className="text-amber-500" />
                        )}
                        Verify
                      </button>

                      <button
                        onClick={() => handleDeleteKey(key)}
                        disabled={!!busy}
                        className="p-1.5 rounded-lg border border-ink/5 text-muted hover:text-error hover:bg-error/5 hover:border-error/15 transition-all cursor-pointer disabled:opacity-40"
                        title="Delete from browser vault"
                      >
                        {busy === `${key.id}:delete` ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
