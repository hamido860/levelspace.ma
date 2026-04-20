import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Database, 
  Cloud, 
  ShieldCheck, 
  Table as TableIcon,
  ExternalLink
} from 'lucide-react';
import { supabase, checkSupabaseConnection } from '../db/supabase';

interface ConnectionStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const ConnectionStatusModal: React.FC<ConnectionStatusModalProps> = ({ 
  isOpen, 
  onClose,
  onRefresh
}) => {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<{
    url: boolean;
    key: boolean;
    tables: boolean;
    auth: boolean;
    error?: string;
  }>({
    url: false,
    key: false,
    tables: false,
    auth: false
  });

  const runCheck = async () => {
    setChecking(true);
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    const urlValid = !!url && url.startsWith('http');
    const keyValid = !!key && key !== 'YOUR_SUPABASE_ANON_KEY';
    
    let tablesExist = false;
    let authOk = false;
    let errorMsg = undefined;

    if (urlValid && keyValid) {
      try {
        const { error } = await supabase.from('lessons').select('id').limit(1);
        if (!error) {
          tablesExist = true;
        } else if (error.code === 'PGRST116' || error.message.includes('relation "public.lessons" does not exist')) {
          errorMsg = 'Tables missing. Please run the SQL schema in Supabase.';
        } else {
          errorMsg = error.message;
        }
        
        const { data: { session } } = await supabase.auth.getSession();
        authOk = !!session;
      } catch (err: any) {
        errorMsg = err.message;
      }
    }

    setStatus({
      url: urlValid,
      key: keyValid,
      tables: tablesExist,
      auth: authOk,
      error: errorMsg
    });
    setChecking(false);
    onRefresh();
  };

  useEffect(() => {
    if (isOpen) {
      runCheck();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-paper w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-ink/5"
        >
          <div className="p-6 border-b border-ink/5 flex items-center justify-between bg-surface-low">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg">Database Connection</h3>
                <p className="text-xs text-muted">Supabase Status & Diagnostics</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-ink/5 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <StatusItem 
                icon={<Cloud className="w-4 h-4" />}
                label="Supabase URL"
                status={status.url ? 'success' : 'error'}
                desc={status.url ? 'Valid endpoint configured' : 'Missing or invalid URL'}
              />
              <StatusItem 
                icon={<ShieldCheck className="w-4 h-4" />}
                label="Anon Key"
                status={status.key ? 'success' : 'error'}
                desc={status.key ? 'API key is present' : 'Missing or placeholder key'}
              />
              <StatusItem 
                icon={<TableIcon className="w-4 h-4" />}
                label="Database Tables"
                status={status.tables ? 'success' : 'error'}
                desc={status.tables ? 'Schema verified' : 'Tables not found or unreachable'}
              />
            </div>

            {status.error && (
              <div className="p-4 bg-error/5 border border-error/10 rounded-2xl flex gap-3">
                <AlertCircle className="w-5 h-5 text-error shrink-0" />
                <div className="text-sm">
                  <p className="font-bold text-error mb-1">Diagnostic Info</p>
                  <p className="text-error/80 leading-relaxed">{status.error}</p>
                </div>
              </div>
            )}

            {!status.tables && status.url && status.key && (
              <div className="p-4 bg-accent/5 border border-accent/10 rounded-2xl">
                <p className="text-sm text-accent font-medium mb-2">How to fix:</p>
                <ol className="text-xs text-accent/80 space-y-2 list-decimal list-inside">
                  <li>Open your Supabase Dashboard</li>
                  <li>Go to the SQL Editor</li>
                  <li>Copy content from <code className="bg-accent/10 px-1 rounded">supabase-schema.sql</code></li>
                  <li>Run the query to create tables and policies</li>
                </ol>
              </div>
            )}
          </div>

          <div className="p-6 bg-surface-low border-t border-ink/5 flex gap-3">
            <button
              onClick={runCheck}
              disabled={checking}
              className="flex-1 py-3 bg-ink text-paper rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-accent transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Checking...' : 'Refresh Connection'}
            </button>
            <a 
              href="https://supabase.com/dashboard" 
              target="_blank" 
              rel="noreferrer"
              className="p-3 border border-ink/10 rounded-xl hover:bg-ink/5 transition-all"
              title="Open Supabase Dashboard"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const StatusItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  status: 'success' | 'error' | 'pending';
  desc: string;
}> = ({ icon, label, status, desc }) => (
  <div className="flex items-start gap-4">
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
      status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 
      status === 'error' ? 'bg-error/10 text-error' : 
      'bg-muted/10 text-muted'
    }`}>
      {icon}
    </div>
    <div className="flex-1">
      <div className="flex items-center justify-between mb-0.5">
        <span className="font-bold text-sm">{label}</span>
        {status === 'success' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : status === 'error' ? (
          <AlertCircle className="w-4 h-4 text-error" />
        ) : null}
      </div>
      <p className="text-xs text-muted">{desc}</p>
    </div>
  </div>
);
