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

  return (
    <div className="space-y-5">
      <section className="ls-card-pad space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-serif text-ink">AI API keys</h1>
              <p className="ls-body-text max-w-2xl">
                Your API key is encrypted and stored securely. It is only decrypted on the server when making AI requests.
                The full key is never shown again after saving.
              </p>
            </div>
          </div>

          <div className="ls-card-pad ls-micro-label lg:min-w-72">
            <div className="flex items-center gap-2 font-semibold text-ink">
              <Server className="w-4 h-4" />
              Platform AI
            </div>
            <div className="mt-2 space-y-1">
              <p>{platformStatus?.platformCreditsEnabled === false ? 'Platform credits disabled' : 'Platform credits available when server keys exist'}</p>
              <p>
                Server providers:{' '}
                <span className="font-semibold text-ink">
                  {platformProviderLabels.length > 0 ? platformProviderLabels.join(', ') : 'none detected'}
                </span>
              </p>
              {devAdminEnabled && (
                <p>
                  Developer keys:{' '}
                  <span className="font-semibold text-ink">
                    {devAdminProviderLabels.length > 0 ? devAdminProviderLabels.join(', ') : 'enabled, no provider key detected'}
                  </span>
                </p>
              )}
              <p>
                Default:{' '}
                <span className="font-semibold text-ink">{platformStatus?.defaultProvider || 'gemini'}</span>
                {platformStatus?.fallbackProvider ? `, fallback ${platformStatus.fallbackProvider}` : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={mode === 'byok'}
            onClick={() => saveMode('byok')}
            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${mode === 'byok' ? 'bg-ink text-paper border-ink' : 'bg-paper border-surface-mid text-ink-secondary hover:border-ink/15'}`}
          >
            <Key className="w-4 h-4" />
            <span>
              <span className="block text-sm font-semibold">Use my own API key</span>
              <span className={`block text-[10px] ${mode === 'byok' ? 'text-paper/60' : 'text-ink-muted'}`}>
                {configuredByokCount} saved provider{configuredByokCount === 1 ? '' : 's'}
              </span>
            </span>
          </button>
          <button
            type="button"
            aria-pressed={mode === 'platform'}
            onClick={() => saveMode('platform')}
            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${mode === 'platform' ? 'bg-ink text-paper border-ink' : 'bg-paper border-surface-mid text-ink-secondary hover:border-ink/15'}`}
          >
            <Zap className="w-4 h-4" />
            <span>
              <span className="block text-sm font-semibold">Use platform AI credits if available</span>
              <span className={`block text-[10px] ${mode === 'platform' ? 'text-paper/60' : 'text-ink-muted'}`}>
                {platformStatus?.configured ? 'Server key detected' : 'No server key detected'}
              </span>
            </span>
          </button>
        </div>

        <div className="space-y-2">
          <label className="ls-micro-label">Preferred AI provider</label>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => saveSelectedProvider(provider.id)}
                className={`rounded-xl border p-3 text-left text-sm font-semibold transition-colors ${selectedProvider === provider.id ? 'bg-accent text-paper border-accent' : 'bg-paper border-surface-mid text-ink-secondary hover:border-ink/15'}`}
              >
                <span className="block">{provider.label}</span>
                {devAdminEnabled && (
                  <span className={`block text-[10px] ${selectedProvider === provider.id ? 'text-paper/70' : platformStatus?.devAdmin?.providers?.[provider.id] ? 'text-emerald-600' : 'text-ink-muted'}`}>
                    {platformStatus?.devAdmin?.providers?.[provider.id] ? 'Developer key available' : 'No developer key'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center gap-2 ls-body-text">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading saved providers...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {loadError && (
            <section className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 text-sm text-destructive">
              {loadError}
            </section>
          )}
          {mode === 'byok' && !selectedMetadata?.key_preview && (
            <section className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-sm text-amber-800">
              No API key saved for this provider. Add it once in AI Keys settings.
            </section>
          )}
          {devAdminEnabled ? (
            <section className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-sm text-amber-800 space-y-1">
              <p className="font-semibold text-amber-900">
                Developer AI key mode is enabled
              </p>
              <p>Using temporary admin/developer key from server environment variables.</p>
              <p>Temporary development mode. Replace with authenticated per-user keys before production.</p>
            </section>
          ) : !authenticated && (
            <section className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-sm text-amber-800">
              Development fallback is active until auth is implemented. Production refuses unauthenticated key saving.
            </section>
          )}
          {PROVIDERS.map((provider) => {
            const metadata = metadataFor(provider.id);
            const devConfigured = Boolean(platformStatus?.devAdmin?.providers?.[provider.id]);
            const configured = Boolean(metadata?.is_active && metadata.key_preview);
            const canTest = Boolean(configured || drafts[provider.id].trim());
            return (
              <section key={provider.id} className="ls-card-pad space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">{provider.label}</h2>
                    <div className={`mt-1 inline-flex items-center gap-2 text-xs font-semibold ${configured || devConfigured ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {configured || devConfigured ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {configured
                        ? `Saved as ${metadata?.key_preview}`
                        : devConfigured
                          ? 'Using temporary admin/developer key'
                          : 'Missing'}
                    </div>
                    {metadata?.last_test_status && (
                      <div className="mt-1 ls-micro-label">
                        Last test: {metadata.last_test_status}
                        {metadata.last_tested_at ? ` at ${new Date(metadata.last_tested_at).toLocaleString()}` : ''}
                      </div>
                    )}
                  </div>
                  {metadata?.updated_at && (
                    <span className="ls-micro-label">Updated {new Date(metadata.updated_at).toLocaleString()}</span>
                  )}
                </div>

                <div className="flex flex-col md:flex-row gap-2">
                  <input
                    type="password"
                    autoComplete="off"
                    value={drafts[provider.id]}
                    onChange={(event) => setDrafts((current) => ({ ...current, [provider.id]: event.target.value }))}
                    placeholder={configured ? 'Paste a new key to replace the saved key' : provider.placeholder}
                    className="min-w-0 flex-1 rounded-xl border border-surface-mid bg-paper px-3 py-2 text-sm outline-none focus:border-ink/15"
                  />
                  <button
                    type="button"
                    onClick={() => saveKey(provider.id)}
                    disabled={busy === `${provider.id}:save`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
                  >
                    {busy === `${provider.id}:save` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => testKey(provider.id)}
                    disabled={!canTest || busy === `${provider.id}:test`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-surface-mid px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
                  >
                    {busy === `${provider.id}:test` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteKey(provider.id)}
                    disabled={!configured || busy === `${provider.id}:delete`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/20 px-4 py-2 text-sm font-semibold text-destructive disabled:opacity-50"
                  >
                    {busy === `${provider.id}:delete` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
