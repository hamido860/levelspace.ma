import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Key, Loader2, Save, Server, ShieldCheck, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../db/supabase';

type Provider = 'gemini' | 'openrouter' | 'openai';
type CredentialMode = 'byok' | 'platform';

type KeyMetadata = {
  provider: Provider;
  key_preview: string | null;
  is_active: boolean;
  last_test_status: string | null;
  last_tested_at: string | null;
  updated_at: string | null;
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

const PROVIDERS: { id: Provider; label: string; placeholder: string }[] = [
  { id: 'gemini', label: 'Gemini', placeholder: 'AIza...' },
  { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-...' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
];

const authHeaders = async () => {
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

export const AiKeyManager: React.FC = () => {
  const [keys, setKeys] = useState<KeyMetadata[]>([]);
  const [drafts, setDrafts] = useState<Record<Provider, string>>({ gemini: '', openrouter: '', openai: '' });
  const [mode, setMode] = useState<CredentialMode>(() => (localStorage.getItem('ai_credential_mode') === 'platform' ? 'platform' : 'byok'));
  const [selectedProvider, setSelectedProvider] = useState<Provider>(() => {
    const stored = localStorage.getItem('ai_provider');
    return stored === 'openrouter' || stored === 'openai' || stored === 'gemini' ? stored : 'gemini';
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadKeys = async () => {
    setLoading(true);
    try {
      const { authenticated: hasSession, headers } = await authHeaders();
      setAuthenticated(hasSession);
      setLoadError('');

      const statusResponse = await fetch('/api/ai/status');

      if (statusResponse.ok) {
        const statusData = await statusResponse.json().catch(() => null);
        setPlatformStatus(statusData);
      }

      const keysResponse = await fetch('/api/settings/ai-keys', { headers });
      const keysData = await keysResponse.json().catch(() => ({}));
      if (!keysResponse.ok) throw new Error(keysData.error || 'Unable to load AI keys.');
      setKeys(keysData.keys || []);
    } catch (error: any) {
      setKeys([]);
      setLoadError(error.message || 'Unable to load AI keys.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  useEffect(() => {
    const devDefault = platformStatus?.devAdmin?.defaultProvider;
    if (!localStorage.getItem('ai_provider') && (devDefault === 'gemini' || devDefault === 'openrouter' || devDefault === 'openai')) {
      setSelectedProvider(devDefault);
      localStorage.setItem('ai_provider', devDefault);
    }
  }, [platformStatus]);

  const saveMode = (nextMode: CredentialMode) => {
    setMode(nextMode);
    localStorage.setItem('ai_credential_mode', nextMode);
  };

  const saveSelectedProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    localStorage.setItem('ai_provider', provider);
    localStorage.removeItem('ai_model');
  };

  const saveKey = async (provider: Provider) => {
    const apiKey = drafts[provider].trim();
    if (!apiKey) {
      toast.error('Paste an API key first.');
      return;
    }

    setBusy(`${provider}:save`);
    try {
      const response = await fetch('/api/settings/ai-keys', {
        method: 'POST',
        headers: (await authHeaders()).headers,
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to save API key.');

      setDrafts((current) => ({ ...current, [provider]: '' }));
      await loadKeys();
      toast.success(`${PROVIDERS.find((item) => item.id === provider)?.label} key saved`);
    } catch (error: any) {
      toast.error('Save failed', { description: error.message });
    } finally {
      setBusy(null);
    }
  };

  const testKey = async (provider: Provider) => {
    setBusy(`${provider}:test`);
    try {
      const draftKey = drafts[provider].trim();
      const response = await fetch('/api/settings/ai-keys/test', {
        method: 'POST',
        headers: (await authHeaders()).headers,
        body: JSON.stringify({ provider, ...(draftKey ? { apiKey: draftKey } : {}) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Invalid API key.');
      toast.success('Key test passed');
      await loadKeys();
    } catch (error: any) {
      toast.error('Key test failed', { description: error.message });
    } finally {
      setBusy(null);
    }
  };

  const deleteKey = async (provider: Provider) => {
    setBusy(`${provider}:delete`);
    try {
      const response = await fetch(`/api/settings/ai-keys/${provider}`, {
        method: 'DELETE',
        headers: (await authHeaders()).headers,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to delete API key.');
      await loadKeys();
      toast.success('Key deleted');
    } catch (error: any) {
      toast.error('Delete failed', { description: error.message });
    } finally {
      setBusy(null);
    }
  };

  const metadataFor = (provider: Provider) => keys.find((item) => item.provider === provider);
  const configuredByokCount = keys.filter((item) => item.is_active && item.key_preview).length;
  const selectedMetadata = metadataFor(selectedProvider);
  const platformProviderLabels = Object.entries(platformStatus?.providers || {})
    .filter(([, configured]) => configured)
    .map(([provider]) => provider);
  const devAdminEnabled = Boolean(platformStatus?.devAdmin?.enabled);
  const devAdminProviderLabels = Object.entries(platformStatus?.devAdmin?.providers || {})
    .filter(([, configured]) => configured)
    .map(([provider]) => provider);


  const [showKey, setShowKey] = useState(false);
  const activeProvider = PROVIDERS.find(p => p.id === selectedProvider) || PROVIDERS[0];
  const activeDraft = drafts[activeProvider.id] || '';
  const isBusy = busy === `${activeProvider.id}:save`;
  const metadata = metadataFor(activeProvider.id);
  const configured = Boolean(metadata?.is_active && metadata.key_preview);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="bg-surface-low border border-ink/10 rounded-2xl p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-ink flex items-center gap-2">
            <Key className="w-5 h-5 text-accent" />
            AI Setup
          </h2>
          <p className="text-sm text-ink-secondary mt-1">
            Add your API key to start using AI features.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-ink mb-3">Select Provider:</label>
            <div className="flex flex-wrap gap-4">
              {PROVIDERS.map((provider) => (
                <label key={provider.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ai_provider"
                    value={provider.id}
                    checked={selectedProvider === provider.id}
                    onChange={() => saveSelectedProvider(provider.id)}
                    className="w-4 h-4 text-accent border-surface-mid focus:ring-accent"
                  />
                  <span className="text-sm text-ink font-medium">{provider.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-ink">
              Enter {activeProvider.label} API Key
            </label>
            <div className="flex relative">
              <input
                type={showKey ? "text" : "password"}
                autoComplete="off"
                value={activeDraft}
                onChange={(event) => setDrafts((current) => ({ ...current, [activeProvider.id]: event.target.value }))}
                placeholder={configured ? `Saved as ${metadata?.key_preview} (Enter new to replace)` : activeProvider.placeholder}
                className="w-full rounded-xl border border-surface-mid bg-paper px-4 py-3 pr-12 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
                aria-label={showKey ? "Hide API Key" : "Show API Key"}
              >
                {showKey ? <span>🙈</span> : <span>👁️</span>}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => saveKey(activeProvider.id)}
              disabled={isBusy || (!activeDraft.trim() && !configured)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-paper hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save API Key
            </button>
            {configured && (
              <p className="mt-3 text-xs text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                API key is successfully saved and active.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

};
