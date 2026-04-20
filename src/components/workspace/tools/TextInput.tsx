
import React, { useState, useEffect } from 'react';
import { FileText, Save, Trash2, Type, Bold, Italic, List } from 'lucide-react';

interface TextInputProps {
  state: any;
  onChange: (state: any) => void;
}

export const TextInput: React.FC<TextInputProps> = ({ state, onChange }) => {
  const [text, setText] = useState(state.text || '');

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange({ ...state, text });
    }, 500); // Debounce
    return () => clearTimeout(timer);
  }, [text]);

  const handleClear = () => {
    if (confirm('Are you sure you want to clear your notes?')) {
      setText('');
      onChange({ ...state, text: '' });
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-accent">
          <FileText className="w-4 h-4" />
          <h3 className="text-sm font-bold uppercase tracking-widest">Notes & Answers</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-paper border border-ink/5 rounded-lg p-1">
            <button className="p-1.5 hover:bg-surface-low rounded text-muted hover:text-ink transition-colors"><Bold size={14} /></button>
            <button className="p-1.5 hover:bg-surface-low rounded text-muted hover:text-ink transition-colors"><Italic size={14} /></button>
            <button className="p-1.5 hover:bg-surface-low rounded text-muted hover:text-ink transition-colors"><List size={14} /></button>
          </div>
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
        <div className="relative flex-grow">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your notes or answer here..."
            className="w-full h-full p-6 bg-paper border border-ink/10 rounded-2xl shadow-inner text-sm leading-relaxed outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none font-sans"
          />
          <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-paper/80 backdrop-blur-sm border border-ink/5 rounded-full text-[9px] font-bold text-muted uppercase tracking-widest shadow-sm">
            <Save className="w-3 h-3 text-emerald-500" />
            Auto-saved
          </div>
        </div>

        <div className="p-4 bg-accent/5 border border-accent/10 rounded-xl flex items-start gap-3">
          <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent shrink-0">
            <Type className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-ink">Writing Tip</p>
            <p className="text-[10px] text-muted leading-relaxed">
              Structure your answer with clear points. Use the formatting tools to highlight key concepts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
