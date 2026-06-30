import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, KeyRound, RefreshCw, Server, XCircle } from 'lucide-react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';

type AiStatus = {
  configured: boolean;
  providers: Record<string, boolean>;
  models: Record<string, string>;
  defaultProvider: string;
  fallbackProvider: string | null;
  fallbackEnabled: boolean;
  platformCreditsEnabled: boolean;
  diagnostics?: {
    aiProvider: string | null;
    fallbackProvider: string | null;
    fallbackEnabled: boolean;
    hasGeminiKey: boolean;
    hasOpenRouterKey: boolean;
    hasOpenAIKey: boolean;
    hasNvidiaKey: boolean;
    devAdminKeysEnabled: boolean;
    hasDevAdminProviderKey: boolean;
    hasEncryptionSecret: boolean;
    hasSupabaseClientConfig: boolean;
    hasSupabaseServerConfig: boolean;
    warnings: string[];
  };
};

const PROVIDERS = ['gemini', 'nvidia', 'openrouter', 'openai'];

const StatusPill: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${ok ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>
    {ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
    {label}
  </div>
);

export const AdminAiDiagnostics: React.FC = () => {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/status');
      const data = await response.json();
      setStatus(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  return (
    <Layout>
      <SEO title="AI Diagnostics | Levelspace Admin" description="Platform AI key diagnostics." />
      <div className="space-y-5">
        <section className="ls-card-pad flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-serif text-slate-950">AI diagnostics</h1>
              <p className="ls-body-text">Checks server environment wiring without exposing API keys or Supabase secrets.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadStatus}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </section>

        <section className="ls-card-pad">
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
                <Server className="w-4 h-4" />
                Provider routing
              </div>
              <div className="mt-3 space-y-2">
                <StatusPill ok={Boolean(status?.diagnostics?.aiProvider)} label={`Primary: ${status?.diagnostics?.aiProvider || 'invalid'}`} />
                <StatusPill ok={!status?.diagnostics?.fallbackEnabled || Boolean(status?.diagnostics?.fallbackProvider)} label={`Fallback: ${status?.diagnostics?.fallbackProvider || 'none'}`} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
                <KeyRound className="w-4 h-4" />
                Key persistence
              </div>
              <div className="mt-3 space-y-2">
                <StatusPill ok={Boolean(status?.diagnostics?.hasEncryptionSecret)} label="Encryption secret" />
                <StatusPill ok={!status?.diagnostics?.devAdminKeysEnabled || Boolean(status?.diagnostics?.hasDevAdminProviderKey)} label={status?.diagnostics?.devAdminKeysEnabled ? 'Dev admin key' : 'Dev admin disabled'} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
                <Database className="w-4 h-4" />
                Supabase
              </div>
              <div className="mt-3 space-y-2">
                <StatusPill ok={Boolean(status?.diagnostics?.hasSupabaseClientConfig)} label="Client config" />
                <StatusPill ok={Boolean(status?.diagnostics?.hasSupabaseServerConfig)} label="Server admin config" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PROVIDERS.map((provider) => {
              const configured = Boolean(status?.providers?.[provider]);
              return (
                <div key={provider} className="ls-card-pad">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold capitalize text-slate-950">{provider}</h2>
                      <p className="ls-micro-label">{status?.models?.[provider] || 'No model override'}</p>
                    </div>
                    <div className={`inline-flex items-center gap-2 text-xs font-semibold ${configured ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {configured ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {configured ? 'Configured' : 'Missing'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {status && (
            <div className="mt-4 ls-micro-label">
              Default: {status.defaultProvider}. Fallback: {status.fallbackEnabled ? status.fallbackProvider || 'none' : 'disabled'}. Platform credits: {status.platformCreditsEnabled ? 'enabled' : 'disabled'}.
            </div>
          )}
          {status?.diagnostics?.warnings?.length ? (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
                <AlertTriangle className="w-4 h-4" />
                Environment warnings
              </div>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {status.diagnostics.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : status ? (
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-800">
              No environment warnings detected.
            </div>
          ) : null}
        </section>
      </div>
    </Layout>
  );
};
