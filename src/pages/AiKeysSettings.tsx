import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Key, Loader2, Save, ShieldCheck, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';
import { supabase } from '../db/supabase';

type Provider = 'gemini' | 'openrouter' | 'openai';
type CredentialMode = 'byok' | 'platform';

type KeyMetadata = {
  provider: Provider;
  configured: boolean;
  keyLast4: string | null;
  isActive: boolean;
  updatedAt: string | null;
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
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const AiKeysSettings: React.FC = () => {
  const [keys, setKeys] = useState<KeyMetadata[]>([]);
  const [drafts, setDrafts] = useState<Record<Provider, string>>({ gemini: '', openrouter: '', openai: '' });
  const [mode, setMode] = useState<CredentialMode>(() => (localStorage.getItem('ai_credential_mode') === 'byok' ? 'byok' : 'platform'));
  const [selectedProvider, setSelectedProvider] = useState<Provider>(() => {
    const stored = localStorage.getItem('ai_provider');
    return stored === 'openrouter' || stored === 'openai' || stored === 'gemini' ? stored : 'gemini';
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/ai-keys', { headers: await authHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to load AI keys.');
      setKeys(data.keys || []);
    } catch (error: any) {
      toast.error('Unable to load AI keys', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

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
      const response = await fetch('/api/user/ai-keys', {
        method: 'POST',
        headers: await authHeaders(),
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
      const response = await fetch('/api/user/ai-keys/test', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ provider }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Provider rejected the saved key.');
      toast.success('Key test passed');
    } catch (error: any) {
      toast.error('Key test failed', { description: error.message });
    } finally {
      setBusy(null);
    }
  };

  const deleteKey = async (provider: Provider) => {
    setBusy(`${provider}:delete`);
    try {
      const response = await fetch(`/api/user/ai-keys/${provider}`, {
        method: 'DELETE',
        headers: await authHeaders(),
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

  const metadataFor = (provider: Provider) => keys.find((key) => key.provider === provider);

  return (
    <Layout>
      <SEO title="AI API Keys | Levelspace" description="Manage your encrypted AI provider API keys." />
      <div className="space-y-5">
        <section className="bg-paper border border-ink/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-serif text-ink">AI API keys</h1>
              <p className="text-sm text-muted max-w-2xl">
                Your API key is encrypted and stored securely. It is only decrypted on the server when making AI requests.
                The full key is never shown again after saving.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => saveMode('byok')}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${mode === 'byok' ? 'bg-ink text-paper border-ink' : 'bg-background border-ink/10 text-ink hover:border-accent/40'}`}
            >
              <Key className="w-4 h-4" />
              <span className="text-sm font-semibold">Use my own API key</span>
            </button>
            <button
              type="button"
              onClick={() => saveMode('platform')}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${mode === 'platform' ? 'bg-ink text-paper border-ink' : 'bg-background border-ink/10 text-ink hover:border-accent/40'}`}
            >
              <Zap className="w-4 h-4" />
              <span className="text-sm font-semibold">Use platform AI credits if available</span>
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Preferred AI provider</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => saveSelectedProvider(provider.id)}
                  className={`rounded-xl border p-3 text-left text-sm font-semibold transition-colors ${selectedProvider === provider.id ? 'bg-accent text-paper border-accent' : 'bg-background border-ink/10 text-ink hover:border-accent/40'}`}
                >
                  {provider.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading saved providers...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {PROVIDERS.map((provider) => {
              const metadata = metadataFor(provider.id);
              const configured = Boolean(metadata?.configured);
              return (
                <section key={provider.id} className="bg-paper border border-ink/10 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-ink">{provider.label}</h2>
                      <div className={`mt-1 inline-flex items-center gap-2 text-xs font-semibold ${configured ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {configured ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {configured ? `Configured ending in ${metadata?.keyLast4 || '****'}` : 'Missing'}
                      </div>
                    </div>
                    {metadata?.updatedAt && (
                      <span className="text-xs text-muted">Updated {new Date(metadata.updatedAt).toLocaleString()}</span>
                    )}
                  </div>

                  <div className="flex flex-col md:flex-row gap-2">
                    <input
                      type="password"
                      autoComplete="off"
                      value={drafts[provider.id]}
                      onChange={(event) => setDrafts((current) => ({ ...current, [provider.id]: event.target.value }))}
                      placeholder={configured ? 'Paste a new key to replace the saved key' : provider.placeholder}
                      className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/20"
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
                      disabled={!configured || busy === `${provider.id}:test`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink/10 px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
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
    </Layout>
  );
};
