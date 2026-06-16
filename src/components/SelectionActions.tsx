import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Loader2, Languages, MessageCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getQuickDefinition } from '../services/geminiService';
import { ExplanationModal } from './ExplanationModal';
import { useLanguage } from '../context/LanguageContext';

type QuickDefResult = {
  definition: string;
  languages: { en: string; fr: string; ar: string };
};

type SelectionState = 'idle' | 'loading' | 'result';

const IGNORE_SELECTION_SELECTOR = [
  '#selection-actions',
  '[data-selection-actions-ignore="true"]',
  '.explanation-modal-content',
  'button',
  'a',
  'input',
  'textarea',
  'select',
  '[role="button"]',
  '[contenteditable="true"]',
].join(',');

const ALLOWED_SELECTION_SELECTOR = [
  '[data-smart-select-scope="true"]',
  '.lesson-reader-markdown',
  '.lesson-reader-block',
  '.lesson-copy',
  '.lesson-content',
  '.markdown-body',
  '.prose',
].join(',');

const getElementFromNode = (node: Node | null) => {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
};

const isInsideIgnoredUi = (target: EventTarget | Node | null) =>
  target instanceof Element && Boolean(target.closest(IGNORE_SELECTION_SELECTOR));

const isAllowedSelectionSurface = (range: Range, target: EventTarget | null) => {
  const targetElement = target instanceof Element ? target : null;
  const ancestorElement = getElementFromNode(range.commonAncestorContainer);
  return Boolean(
    targetElement?.closest(ALLOWED_SELECTION_SELECTOR) ||
    ancestorElement?.closest(ALLOWED_SELECTION_SELECTOR)
  );
};

export const SelectionActions = () => {
  const { language } = useLanguage();
  const [selection, setSelection] = useState<{
    text: string;
    context: string;
    rect: DOMRect;
  } | null>(null);

  const [state, setState] = useState<SelectionState>('idle');
  const [result, setResult] = useState<QuickDefResult | null>(null);
  const [isExplanationModalOpen, setIsExplanationModalOpen] = useState(false);

  const resetSelection = (clearBrowserSelection = false) => {
    setSelection(null);
    setState('idle');
    setResult(null);
    window.dispatchEvent(new CustomEvent('inline-selection-assistant:close'));
    if (clearBrowserSelection) window.getSelection()?.removeAllRanges();
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      const activeSelection = window.getSelection();
      if (!activeSelection || !activeSelection.toString().trim()) {
        if (!isExplanationModalOpen) {
          resetSelection();
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      setTimeout(() => {
        const activeSelection = window.getSelection();
        if (activeSelection && !activeSelection.isCollapsed && activeSelection.toString().trim()) {
          const text = activeSelection.toString().trim();
          
          if (text.length > 100) {
            resetSelection();
            return;
          }

          if (activeSelection.rangeCount === 0 || isInsideIgnoredUi(e.target)) return;

          const range = activeSelection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          if (!rect.width && !rect.height) {
            resetSelection();
            return;
          }

          if (!isAllowedSelectionSurface(range, e.target)) {
            resetSelection();
            return;
          }

          // Extract surrounding text for context
          const container = getElementFromNode(range.startContainer);
          const context = container ? (container.textContent || '').slice(0, 800) : text;

          const newSelection = { text, context, rect };
          setSelection(newSelection);
          setResult(null);
          window.dispatchEvent(new CustomEvent('inline-selection-assistant:open', { detail: { text } }));

          const wordCount = text.split(/\s+/).filter(Boolean).length;
          if (wordCount <= 4) {
            setState('loading');
            getQuickDefinition(text, context)
              .then((def) => {
                if (def) {
                  setResult(def);
                  setState('result');
                } else {
                  setState('idle');
                }
              })
              .catch(() => {
                setState('idle');
              });
          } else {
            setState('idle');
          }
        } else {
          if (e.target instanceof Element && !e.target.closest('#selection-actions')) {
            if (!isExplanationModalOpen) {
              resetSelection();
            }
          }
        }
      }, 10);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (isInsideIgnoredUi(e.target)) return;
      if (!isExplanationModalOpen) {
        resetSelection();
      }
    };

    const handleExternalAssistantOpen = () => {
      if (!isExplanationModalOpen) resetSelection();
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('open-ai-assistant' as any, handleExternalAssistantOpen);
    window.addEventListener('smart-selection-assistant:open' as any, handleExternalAssistantOpen);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('open-ai-assistant' as any, handleExternalAssistantOpen);
      window.removeEventListener('smart-selection-assistant:open' as any, handleExternalAssistantOpen);
    };
  }, [isExplanationModalOpen]);

  const handleDefine = async () => {
    if (!selection) return;
    setState('loading');
    const def = await getQuickDefinition(selection.text, selection.context);
    if (def) {
      setResult(def);
      setState('result');
    } else {
      handleAskAI();
    }
  };

  const handleAskAI = () => {
    if (selection) {
      const context = `${selection.text} ${selection.context}`.toLowerCase();
      const shouldUseFrench =
        language === 'fr' ||
        /\b(le|la|les|un|une|des|verbe|phrase|sujet|cours|texte)\b/.test(context) ||
        /[àâçéèêëîïôùûüÿœ]/i.test(context);
      const initialInput = shouldUseFrench
        ? `Aide-moi a comprendre ce qui est difficile dans "${selection.text}".`
        : `Help me understand what is difficult about "${selection.text}".`;
      window.dispatchEvent(
        new CustomEvent('open-ai-assistant', {
          detail: { initialInput }
        })
      );
      resetSelection(true);
    }
  };

  if (!selection) return null;

  const wordCount = selection.text.split(/\s+/).filter(Boolean).length;
  const isShort = wordCount <= 4;

  return createPortal(
    <>
      <AnimatePresence>
        {!isExplanationModalOpen && (
          <motion.div
            id="selection-actions"
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onMouseDown={(e) => e.preventDefault()} // Prevents selection from clearing when clicking buttons
            className="fixed z-[9999] flex flex-col gap-2 bg-ink text-paper p-1.5 rounded-2xl shadow-xl border border-white/10"
            style={{
              top: Math.max(10, selection.rect.top - (state === 'result' ? 140 : 50)),
              left: Math.max(10, selection.rect.left + selection.rect.width / 2),
              transform: 'translateX(-50%)',
              maxWidth: '300px'
            }}
          >
            {state === 'idle' && (
              <div className="flex items-center gap-1">
                {isShort && (
                  <button
                    type="button"
                    onClick={handleDefine}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-wide uppercase hover:bg-white/10 transition-colors"
                  >
                    <Languages size={14} className="text-accent" />
                    Define
                  </button>
                )}
                <button
                  type="button"
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
                <span className="text-xs font-medium text-white/80">Preparing inline explanation...</span>
              </div>
            )}

            {state === 'result' && result && (
              <div className="p-3 space-y-3 w-full animate-in fade-in zoom-in-95 duration-200">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-1">
                    <span className="text-[10px] font-black uppercase text-accent tracking-wider">AI inline explanation</span>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-white/60">
                      <span>{result.languages.en || selection.text}</span>
                      <span>➔</span>
                      <span className="text-accent">{result.languages.fr || result.languages.ar}</span>
                    </div>
                  </div>
                  <p className="text-xs text-white/90 leading-relaxed font-medium">
                    {result.definition}
                  </p>
                </div>

                <div className="flex gap-2 pt-1.5 border-t border-white/10">
                  <button
                    type="button"
                    onClick={handleAskAI}
                    className="flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-xl text-[10px] font-extrabold tracking-wide uppercase bg-accent text-white hover:bg-accent/90 transition-colors shadow-sm"
                  >
                    <Sparkles size={11} />
                    Open tutor
                  </button>
                  {wordCount === 1 && (
                    <button
                      type="button"
                      onClick={() => setIsExplanationModalOpen(true)}
                      className="flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-xl text-[10px] font-bold tracking-wide uppercase hover:bg-white/10 transition-colors text-white/60 hover:text-white border border-white/10"
                    >
                      <MessageCircle size={11} />
                      Details
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ExplanationModal
        isOpen={isExplanationModalOpen}
        onClose={() => {
          setIsExplanationModalOpen(false);
          resetSelection(true);
        }}
        word={selection?.text || ''}
        context={selection?.context || ''}
      />
    </>,
    document.body
  );
};
