import React, { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Server, XCircle } from 'lucide-react';
import { Layout } from '../components/Layout';
import { SEO } from '../components/SEO';

type AiStatus = {
  configured: boolean;
  providers: Record<string, boolean>;
  models: Record<string, string>;
  defaultProvider: string;
  fallbackProvider: string | null;
  platformCreditsEnabled: boolean;
};

const PROVIDERS = ['gemini', 'nvidia', 'openrouter', 'openai'];

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
        <section className="bg-paper border border-ink/10 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-serif text-ink">AI diagnostics</h1>
              <p className="text-sm text-muted">Checks platform AI configuration only. Learner BYOK keys are not read or tested here.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadStatus}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink/10 px-4 py-2 text-sm font-semibold text-ink"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </section>

        <section className="bg-paper border border-ink/10 rounded-2xl p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PROVIDERS.map((provider) => {
              const configured = Boolean(status?.providers?.[provider]);
              return (
                <div key={provider} className="rounded-xl border border-ink/10 bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold capitalize text-ink">{provider}</h2>
                      <p className="text-xs text-muted">{status?.models?.[provider] || 'No model override'}</p>
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
            <div className="mt-4 text-xs text-muted">
              Default: {status.defaultProvider}. Fallback: {status.fallbackProvider || 'none'}. Platform credits: {status.platformCreditsEnabled ? 'enabled' : 'disabled'}.
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};
