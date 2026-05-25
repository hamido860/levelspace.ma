import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Loader2, Languages, MessageCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getQuickDefinition } from '../services/geminiService';

type QuickDefResult = {
  definition: string;
  languages: { en: string; fr: string; ar: string };
};

type SelectionState = 'idle' | 'loading' | 'result';

export const SelectionActions = () => {
  const [selection, setSelection] = useState<{
    text: string;
    context: string;
    rect: DOMRect;
  } | null>(null);

  const [state, setState] = useState<SelectionState>('idle');
  const [result, setResult] = useState<QuickDefResult | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const activeSelection = window.getSelection();
      if (!activeSelection || !activeSelection.toString().trim()) {
        setSelection(null);
        setState('idle');
        setResult(null);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      setTimeout(() => {
        const activeSelection = window.getSelection();
        if (activeSelection && !activeSelection.isCollapsed && activeSelection.toString().trim()) {
          const text = activeSelection.toString().trim();
          
          if (text.length > 300) {
            setSelection(null);
            return;
          }

          const range = activeSelection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          if (e.target instanceof Element && e.target.closest('#selection-actions')) return;

          // Extract surrounding text for context
          const container = range.startContainer.parentElement;
          const context = container ? container.innerText.slice(0, 800) : text;

          setSelection({ text, context, rect });
          setState('idle');
          setResult(null);
        } else {
          if (e.target instanceof Element && !e.target.closest('#selection-actions')) {
             setSelection(null);
          }
        }
      }, 10);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('#selection-actions')) return;
      setSelection(null);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const handleDefine = async () => {
    if (!selection) return;
    setState('loading');
    const def = await getQuickDefinition(selection.text, selection.context);
    if (def) {
      setResult(def);
      setState('result');
    } else {
      // Fallback
      handleAskAI();
    }
  };

  const handleAskAI = () => {
    if (selection) {
      window.dispatchEvent(
        new CustomEvent('open-ai-assistant', {
          detail: { initialInput: selection.text }
        })
      );
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  if (!selection) return null;

  const wordCount = selection.text.split(/\s+/).length;
  const isShort = wordCount <= 4;

  return createPortal(
    <AnimatePresence>
      <motion.div
        id="selection-actions"
        initial={{ opacity: 0, y: 5, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        onMouseDown={(e) => e.preventDefault()} // Prevents selection from clearing when clicking buttons
        className="fixed z-[9999] flex flex-col gap-2 bg-ink text-paper p-1.5 rounded-2xl shadow-xl border border-white/10"
        style={{
          top: Math.max(10, selection.rect.top - (state === 'result' ? 120 : 50)),
          left: Math.max(10, selection.rect.left + selection.rect.width / 2),
          transform: 'translateX(-50%)',
          maxWidth: '300px'
        }}
      >
        {state === 'idle' && (
          <div className="flex items-center gap-1">
            {isShort && (
              <button
                onClick={handleDefine}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-wide uppercase hover:bg-white/10 transition-colors"
              >
                <Languages size={14} className="text-accent" />
                Define
              </button>
            )}
            <button
              onClick={handleAskAI}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-wide uppercase hover:bg-white/10 transition-colors"
            >
              <Bot size={14} className={isShort ? "text-paper/60" : "text-accent"} />
              Ask AI
            </button>
          </div>
        )}

        {state === 'loading' && (
          <div className="flex items-center gap-3 px-4 py-2">
            <Loader2 size={16} className="animate-spin text-accent" />
            <span className="text-xs font-medium text-white/80">Analyzing...</span>
          </div>
        )}

        {state === 'result' && result && (
          <div className="p-3 space-y-3 w-full animate-in fade-in zoom-in-95 duration-200">
            <div>
              <p className="text-xs text-white/90 leading-relaxed font-medium">
                {result.definition}
              </p>
            </div>
            
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
              <span className="bg-white/10 px-2 py-1 rounded-md text-white/80">{result.languages.en}</span>
              <span className="bg-white/10 px-2 py-1 rounded-md text-white/80">{result.languages.fr}</span>
              <span className="bg-white/10 px-2 py-1 rounded-md text-accent">{result.languages.ar}</span>
            </div>

            <div className="h-px w-full bg-white/10" />

            <button
              onClick={handleAskAI}
              className="w-full flex justify-center items-center gap-2 py-1.5 rounded-xl text-[10px] font-bold tracking-wide uppercase hover:bg-white/10 transition-colors text-white/60 hover:text-white"
            >
              <MessageCircle size={12} />
              Discuss in Chat
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
