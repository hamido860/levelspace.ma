
import React, { useEffect, useRef, useState } from 'react';
import 'mathlive';
import { Calculator, Copy, Check, Trash2, Send } from 'lucide-react';
import { useAppSettings } from '../../../context/AppSettingsContext';
import { useAuth } from '../../../context/AuthContext';

interface MathEditorProps {
  state: any;
  onChange: (state: any) => void;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': any;
    }
  }
}

export const MathEditor: React.FC<MathEditorProps> = ({ state, onChange }) => {
  const mathFieldRef = useRef<any>(null);
  const [copied, setCopied] = useState(false);
  const { settings } = useAppSettings();
  const { isAdmin } = useAuth();
  const askAiAccess = settings.ask_ai_access || 'admin';
  const canAskAi = askAiAccess === 'all' || isAdmin;

  useEffect(() => {
    if (mathFieldRef.current) {
      mathFieldRef.current.value = state.latex || '';
    }
  }, []);

  const handleInput = (e: any) => {
    const latex = e.target.value;
    onChange({ ...state, latex });
  };

  const handleCopy = () => {
    if (state.latex) {
      navigator.clipboard.writeText(state.latex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = () => {
    if (mathFieldRef.current) {
      mathFieldRef.current.value = '';
      onChange({ ...state, latex: '' });
    }
  };

  const handleSendToAI = () => {
    if (state.latex) {
      const event = new CustomEvent('open-ai-assistant', {
        detail: { initialInput: state.latex }
      });
      window.dispatchEvent(event);
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-accent">
          <Calculator className="w-4 h-4" />
          <h3 className="text-sm font-bold uppercase tracking-widest">Math Editor</h3>
        </div>
        <div className="flex items-center gap-2">
          {canAskAi && (
            <button
              onClick={handleSendToAI}
              disabled={!state.latex}
              className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors disabled:opacity-50 disabled:hover:bg-accent/10 text-xs font-medium"
              title="Ask AI about this formula"
            >
              <Send size={14} />
              Ask AI
            </button>
          )}
          {canAskAi && <div className="w-px h-4 bg-ink/10 mx-1"></div>}
          <button
            onClick={handleCopy}
            className="p-2 bg-paper border border-ink/5 rounded-lg text-muted hover:text-accent transition-colors"
            title="Copy LaTeX"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button
            onClick={handleClear}
            className="p-2 bg-paper border border-ink/5 rounded-lg text-muted hover:text-error transition-colors"
            title="Clear"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex-grow flex flex-col gap-4">
        <div className="bg-paper border border-ink/10 rounded-2xl p-4 shadow-inner min-h-[120px] flex items-center justify-center">
          {React.createElement('math-field', {
            ref: mathFieldRef,
            onInput: handleInput,
            style: {
              width: '100%',
              fontSize: '1.5rem',
              padding: '1rem',
              border: 'none',
              outline: 'none',
              background: 'transparent'
            }
          })}
        </div>

        <div className="bg-surface-medium/50 rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest">LaTeX Output</p>
          <code className="block text-xs font-mono text-ink break-all bg-paper p-3 rounded-lg border border-ink/5">
            {state.latex || 'Type something above...'}
          </code>
        </div>

        <div className="mt-auto p-4 bg-accent/5 border border-accent/10 rounded-xl flex items-start gap-3">
          <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent shrink-0">
            <Calculator className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-ink">Pro Tip</p>
            <p className="text-[10px] text-muted leading-relaxed">
              Use the virtual keyboard or type standard LaTeX commands like \frac, \sqrt, or ^ for powers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
