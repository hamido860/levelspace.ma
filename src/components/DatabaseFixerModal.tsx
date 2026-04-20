import React from 'react';
import { X, Database, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface DatabaseFixerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatabaseFixerModal: React.FC<DatabaseFixerModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const sqlScript = `-- 1. Create the bac_track_subjects table to map subjects to specific tracks
CREATE TABLE IF NOT EXISTS public.bac_track_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid REFERENCES public.bac_tracks(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  UNIQUE(track_id, subject_id)
);

-- 2. Enable Row Level Security
ALTER TABLE public.bac_track_subjects ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies
CREATE POLICY "Allow public read access" ON public.bac_track_subjects FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert" ON public.bac_track_subjects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated update" ON public.bac_track_subjects FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated delete" ON public.bac_track_subjects FOR DELETE USING (auth.role() = 'authenticated');

-- 4. (Optional) Seed data for Moroccan Baccalaureate
-- You will need to manually insert the mappings based on your subjects' UUIDs and tracks' UUIDs.
-- Example:
-- INSERT INTO public.bac_track_subjects (track_id, subject_id) 
-- SELECT t.id, s.id FROM public.bac_tracks t, public.subjects s 
-- WHERE t.name = 'Sciences Mathématiques A' AND s.name = 'Mathématiques';
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopied(true);
    toast.success("SQL script copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-ink/60 backdrop-blur-md">
      <div className="bg-paper w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-surface-mid">
        <div className="px-6 py-4 border-b border-surface-mid flex items-center justify-between bg-surface-low/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <Database size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Database Schema Fixer</h3>
              <p className="text-[10px] text-ink-muted font-mono">Resolve Track/Subject Mismatch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-mid rounded-xl transition-colors text-ink-muted"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
          <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-accent uppercase tracking-widest">The Problem</h4>
            <p className="text-sm text-ink-secondary leading-relaxed">
              Currently, subjects are mapped to <strong>Grades</strong> (e.g., "2ème année Bac") but not to specific <strong>Tracks</strong> (e.g., "Littéraire"). This causes all subjects for a grade to appear in the dropdown, regardless of the selected track, leading to mismatches (like Math appearing for Littéraire).
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-ink uppercase tracking-widest">The Solution (SQL Migration)</h4>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface-mid hover:bg-surface-high text-ink-secondary rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
              >
                {copied ? <CheckCircle2 size={12} className="text-success" /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy SQL"}
              </button>
            </div>
            <p className="text-xs text-ink-muted">
              Run the following SQL script in your Supabase SQL Editor to create the missing <code>bac_track_subjects</code> table. Once created, the frontend will automatically use it to filter subjects by track.
            </p>
            
            <div className="relative">
              <pre className="p-4 bg-ink text-paper rounded-xl text-[11px] font-mono overflow-x-auto custom-scrollbar leading-relaxed">
                <code>{sqlScript}</code>
              </pre>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-surface-mid bg-surface-low/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-ink text-paper rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-ink/90 transition-all shadow-lg active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
