import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { 
  getDetailedWordExplanation, 
  DetailedWordExplanation 
} from '../services/geminiService';
import { useLanguage } from '../context/LanguageContext';
import { 
  BookOpen, 
  Loader2, 
  Sparkles, 
  Volume2, 
  Languages, 
  Compass, 
  CheckCircle,
  HelpCircle,
  MessageCircle
} from 'lucide-react';

interface ExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  word: string;
  context: string;
}

export const ExplanationModal: React.FC<ExplanationModalProps> = ({
  isOpen,
  onClose,
  word,
  context
}) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DetailedWordExplanation | null>(null);
  const [activeLangTab, setActiveLangTab] = useState<'en' | 'fr' | 'ar'>('en');

  useEffect(() => {
    if (isOpen && word) {
      setLoading(true);
      getDetailedWordExplanation(word, context)
        .then((res) => {
          setData(res);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [isOpen, word, context]);

  const speakWord = (lang: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    
    let speechLang = 'en-US';
    if (lang === 'fr') speechLang = 'fr-FR';
    if (lang === 'ar') speechLang = 'ar-SA';
    
    const textToSpeak = data?.languages[lang as 'en' | 'fr' | 'ar'] || word;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = speechLang;
    window.speechSynthesis.speak(utterance);
  };

  const handleAskAITutor = () => {
    window.dispatchEvent(
      new CustomEvent('open-ai-assistant', {
        detail: { 
          initialInput: `I want to discuss the word "${word}" from the lesson. Its definition is "${data?.definition || ''}". Can you help me understand how to use it in other contexts?` 
        }
      })
    );
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <BookOpen className="text-accent w-5 h-5 shrink-0" />
          <span>Interactive Dictionary</span>
        </div>
      }
      maxWidth="lg"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <Loader2 className="animate-spin text-accent w-10 h-10" />
          <p className="text-sm font-semibold text-slate-500 dark:text-ink-muted">
            Consulting AI Tutor...
          </p>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Main word display */}
          <div className="bg-slate-50 dark:bg-surface-low p-6 rounded-xl border border-slate-200/50 dark:border-white/5 space-y-3 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-ink tracking-tight">
                    {data.word}
                  </h3>
                  {data.phonetic && (
                    <span className="text-xs font-medium text-slate-400 dark:text-ink-muted italic select-none">
                      {data.phonetic}
                    </span>
                  )}
                </div>
                <span className="inline-block bg-accent/10 text-accent text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider">
                  {data.partOfSpeech}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => speakWord(activeLangTab)}
                  className="flex items-center gap-1.5 rounded-xl bg-accent text-white hover:bg-accent-high px-4 py-2 text-xs font-bold transition-all shadow-sm shadow-accent/10"
                >
                  <Volume2 size={14} />
                  Listen Pronunciation
                </button>
              </div>
            </div>
          </div>

          {/* Definitions tab panel */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-ink-muted flex items-center gap-2">
                <Languages size={14} className="text-slate-400" />
                Translations & Equivalents
              </h4>
              <div className="flex gap-1">
                {(['en', 'fr', 'ar'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setActiveLangTab(lang)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all ${
                      activeLangTab === lang
                        ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-low'
                    }`}
                  >
                    {lang === 'en' ? 'English' : lang === 'fr' ? 'French' : 'العربية'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="bg-white dark:bg-paper p-5 rounded-2xl border border-slate-200 dark:border-white/8 min-h-[70px] flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-slate-800 dark:text-ink leading-relaxed">
                {data.languages[activeLangTab]}
              </p>
              <button
                type="button"
                onClick={() => speakWord(activeLangTab)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-surface-low flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-ink transition-colors shrink-0"
                title="Speak Translation"
              >
                <Volume2 size={16} />
              </button>
            </div>
          </div>

          {/* Contextual pedagogical explanation */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-ink-muted flex items-center gap-2">
              <Sparkles size={14} className="text-amber-500" />
              Lesson Meaning & Context
            </h4>
            <div className="bg-amber-50/20 border border-amber-100/50 dark:bg-amber-950/5 dark:border-amber-500/10 p-5 rounded-2xl flex gap-3 text-sm leading-relaxed text-slate-700 dark:text-ink-secondary">
              <Compass className="text-amber-500 w-5 h-5 shrink-0 mt-0.5" />
              <p>{data.pedagogicalExplanation}</p>
            </div>
          </div>

          {/* Real-world examples */}
          {data.examples && data.examples.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-ink-muted flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-500" />
                Example Sentences
              </h4>
              <div className="space-y-3">
                {data.examples.map((ex, i) => (
                  <div 
                    key={i} 
                    className="p-4 rounded-xl border border-slate-150 dark:border-white/5 space-y-1.5 bg-slate-50/50 dark:bg-surface-low/30"
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-ink">
                      💡 "{ex.sentence}"
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-ink-muted italic pl-4">
                      ➔ {ex.translation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Chat Assistant Prompt */}
          <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <p className="text-slate-400 dark:text-ink-muted leading-relaxed">
              Want a deeper explanation? Have a live discussion with the AI Tutor.
            </p>
            <button
              type="button"
              onClick={handleAskAITutor}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-50 px-4 py-2.5 font-bold transition-all shadow-sm shrink-0"
            >
              <MessageCircle size={14} />
              Discuss with AI Tutor
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-slate-400 dark:text-ink-muted space-y-2">
          <HelpCircle className="w-10 h-10 mx-auto opacity-50" />
          <p className="text-sm font-semibold">Vocabulary Details Unavailable</p>
          <p className="text-xs">We encountered an issue retrieving the word explanation. Please try again later.</p>
        </div>
      )}
    </Modal>
  );
};
