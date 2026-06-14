import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, HelpCircle, BookOpen, Globe, Calculator, Type, Info, PenTool, Zap, Copy, Check, Brain } from 'lucide-react';
import { chatWithTutor, ChatMessage, generateProactiveGreeting, generateFullLesson } from '../services/geminiService';
import { searchLessons, saveLesson } from '../services/ragService';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { toast } from 'sonner';
import 'mathlive';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': any;
    }
  }
}

interface AIAssistantProps {
  lessonContent: string;
  strictRAG?: boolean;
  subject?: string;
  grade?: string;
  title?: string;
  aiAvailable?: boolean;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ lessonContent, strictRAG, subject, grade, title, aiAvailable = true }) => {
  const { language } = useLanguage();
  const { user, isAdmin } = useAuth();
  const { settings } = useAppSettings();
  const askAiAccess = settings.ask_ai_access || 'admin';
  const hasAccess = askAiAccess === 'all' || (askAiAccess === 'admin' && isAdmin);

  const [isOpen, setIsOpen] = useState(false);
  const [greetingFetched, setGreetingFetched] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMathMode, setIsMathMode] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const [pendingInitialInput, setPendingInitialInput] = useState<string | null>(null);
  const mathFieldRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handleOpenAIAssistant = (e: CustomEvent<{ initialInput?: string }>) => {
      setIsOpen(true);
      if (e.detail?.initialInput) {
        // Skip proactive greeting since user has an immediate query
        setGreetingFetched(true);
        setPendingInitialInput(e.detail.initialInput);
      }
    };

    window.addEventListener('open-ai-assistant' as any, handleOpenAIAssistant);
    return () => window.removeEventListener('open-ai-assistant' as any, handleOpenAIAssistant);
  }, []);

  // Lazy greeting: only fetch when the panel is first opened
  useEffect(() => {
    if (!isOpen || greetingFetched || !lessonContent || !aiAvailable) return;
    let isMounted = true;
    setGreetingFetched(true);
    setIsLoading(true);
    generateProactiveGreeting(lessonContent, language, subject, grade)
      .then(greeting => {
        if (isMounted) setMessages([{ role: 'model', parts: [{ text: greeting }] }]);
      })
      .catch(() => {
        if (isMounted) setMessages([{ role: 'model', parts: [{ text: "How can I help you with this lesson? I can answer questions, explain concepts, or test your knowledge." }] }]);
      })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, [isOpen, greetingFetched]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (pendingInitialInput && !isLoading) {
      handleSend(pendingInitialInput);
      setPendingInitialInput(null);
    }
  }, [pendingInitialInput, isLoading]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', parts: [{ text }] };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    if (mathFieldRef.current) {
      mathFieldRef.current.value = '';
    }
    setIsLoading(true);

    try {
      // 1. Check if the user is asking to generate a full lesson
      const isGenerateRequest = text.toLowerCase().includes("generate") && text.toLowerCase().includes("lesson");

      if (isGenerateRequest) {
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: "I'm generating a comprehensive lesson for you. This might take a minute..." }] }]);
        
        const country = localStorage.getItem('selected_country') || '';
        const grade = localStorage.getItem('selected_grade') || 'Grade 10';
        const subject = "General";
        const moduleName = "AI Generated";

        const lesson = await generateFullLesson(text, country, grade, subject, moduleName);
        
        if (lesson) {
          const saved = await saveLesson(lesson, user?.id, true);
          if (saved) {
             setMessages(prev => [...prev, { role: 'model', parts: [{ text: `I've generated and saved a new lesson titled **${lesson.lesson_title}**. You can now ask questions about it!` }] }]);
          } else {
             setMessages(prev => [...prev, { role: 'model', parts: [{ text: `I generated the lesson **${lesson.lesson_title}**, but there was an error saving it to the database.` }] }]);
          }
        } else {
           setMessages(prev => [...prev, { role: 'model', parts: [{ text: "Sorry, I failed to generate the lesson. Please try again." }] }]);
        }
      } else {
        // 2. Normal RAG flow
        const results = await searchLessons(text);
        let context = lessonContent; // Start with current lesson content
        
        if (results.length > 0) {
           context += "\n\nAdditional Context from Database:\n" + results.map(r => `Title: ${r.lesson_title}\nContent: ${r.content}`).join('\n\n');
        }

        const responseText = await chatWithTutor(text, context, messages, language, user?.id, !!strictRAG, subject, grade);
        const modelMessage: ChatMessage = { role: 'model', parts: [{ text: responseText }] };
        setMessages(prev => [...prev, modelMessage]);
      }
    } catch (error) {
      const errorMessage: ChatMessage = { 
        role: 'model', 
        parts: [{ text: "I'm sorry, I encountered an error. Please try again." }] 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: "Generate lesson content", icon: <PenTool size={14} />, prompt: "Can you generate more detailed content for this lesson, including examples and deeper explanations?" },
    { label: "Explain a concept", icon: <HelpCircle size={14} />, prompt: "Can you explain the main concept of this lesson in simpler terms?" },
    { label: "Extend an idea", icon: <Sparkles size={14} />, prompt: "Can you extend on the ideas presented here and give me a real-world application?" },
    { label: "Generate a question", icon: <BookOpen size={14} />, prompt: "Can you generate a practice question based on this lesson to test my understanding?" },
    { label: "Explain in another language", icon: <Globe size={14} />, prompt: `Can you explain the main concepts of this lesson in another language (like French, Arabic, or Spanish) to help me understand better? My preferred interface language is ${language}.` }
  ];

  if (!mounted || !hasAccess) return null;

  if (!aiAvailable) {
    return createPortal(
      <div className="fixed bottom-6 right-6 z-50 group">
        <button
          disabled
          className="w-14 h-14 bg-surface-mid text-muted rounded-full shadow-md flex items-center justify-center cursor-not-allowed opacity-60"
        >
          <MessageCircle size={24} />
        </button>
        <div className="absolute bottom-16 right-0 bg-ink text-paper text-xs px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-sm">
          AI help requires API key
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-accent text-white rounded-full shadow-md flex items-center justify-center hover:bg-accent-hover hover:scale-105 transition-all z-50 group"
          >
            <MessageCircle size={24} className="group-hover:animate-pulse" />
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-error rounded-full border-2 border-background" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 240 }}
            className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[720px] flex-col overflow-hidden border-l border-white/10 bg-[#171c23] text-slate-100 shadow-2xl"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between bg-[#000417] px-8 py-8 text-white">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
                  <Brain className="h-6 w-6 shrink-0" />
                </div>
                <div className="min-w-0 text-left">
                  <h3 className="truncate text-xl font-bold tracking-tight text-white">{title || "AI Tutor"}</h3>
                  <p className="text-[11px] text-white/45 uppercase tracking-[0.18em] font-mono">{subject || "Lesson"} • AI SUPPORT ACTIVE</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-white/55 transition-all hover:bg-white/10 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {/* Messages */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#171c23] px-8 py-8 text-slate-200 custom-scrollbar">
              {messages.length === 0 && isLoading ? (
                <div className="flex h-full min-h-[360px] flex-col items-center justify-center space-y-5 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                    <Loader2 size={36} className="animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-white text-xl">Analyzing Lesson...</h4>
                    <p className="max-w-[320px] text-sm leading-relaxed text-slate-400">
                      I'm reading the material to see how I can best help you.
                    </p>
                  </div>
                </div>
              ) : messages.length === 0 ? null : (
                <>
                  {messages.map((msg, i) => (
                    <div
                      key={i} 
                      className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                        msg.role === 'user' ? 'border border-blue-400/20 bg-[#20262e] text-blue-300' : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                      </div>
                      <div className={`group relative max-w-[86%] rounded-2xl p-4 text-sm ${
                        msg.role === 'user' 
                          ? 'border border-blue-400/20 bg-[#20262e] text-slate-100 rounded-tr-sm shadow-sm'
                          : 'bg-[#20262e] border border-white/8 text-slate-100 rounded-tl-sm shadow-sm pr-10'
                      }`}>
                        {msg.role === 'model' && (
                          <button
                            onClick={() => handleCopy(msg.parts[0].text, i)}
                            className="absolute right-2 top-2 p-1.5 rounded-lg bg-white/5 text-slate-400 opacity-80 hover:opacity-100 hover:text-blue-300 transition-colors"
                            title="Copy message"
                          >
                            {copiedId === i ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        )}
                        {msg.role === 'user' ? (
                          msg.parts[0].text
                        ) : (
                          <div className="prose prose-invert max-w-none text-[0.98rem] text-slate-100 prose-p:leading-7 prose-li:leading-7 prose-strong:text-white prose-pre:bg-slate-950 prose-pre:text-slate-100">
                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false }]]}>{msg.parts[0].text}</Markdown>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {messages.length === 1 && messages[0].role === 'model' && (
                    <div className="flex flex-col gap-2 w-full mt-2 pl-11">
                      {quickActions.map((action, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(action.prompt)}
                          className="flex items-center gap-3 p-2 bg-[#20262e] border border-white/8 rounded-xl text-xs font-medium text-slate-300 hover:border-blue-400/40 hover:text-blue-300 transition-colors text-left max-w-[280px]"
                        >
                          <div className="text-blue-300 shrink-0">{action.icon}</div>
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {isLoading && messages.length > 1 && (
                    <div className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
                        <Bot size={14} />
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-white/8 bg-[#20262e] p-4 shadow-sm">
                        <Loader2 size={14} className="animate-spin text-blue-300" />
                        <span className="text-xs text-slate-400">Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-white/10 bg-[#111820] px-6 py-5">
              <div className="mb-4 flex items-center justify-center gap-2 border-b border-white/10 pb-4">
                {quickActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(action.prompt)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-all hover:scale-105 hover:border-blue-400/40 hover:bg-blue-400/10 hover:text-blue-300 active:scale-95"
                    title={action.label}
                  >
                    {action.icon}
                  </button>
                ))}
              </div>
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsMathMode(!isMathMode)}
                      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        isMathMode 
                          ? 'bg-blue-500/10 text-blue-300' 
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {isMathMode ? <Calculator size={12} /> : <Type size={12} />}
                      {isMathMode ? 'Math Mode' : 'Text Mode'}
                    </button>
                    {isMathMode && (
                      <div className="relative group flex items-center">
                        <Info size={14} className="text-slate-500 hover:text-white transition-colors cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-slate-950 text-white text-[10px] leading-relaxed rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-md">
                          Type standard math notation (e.g., 1/2 for fractions, ^ for exponents) or use the virtual keyboard that appears when you click the input.
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  {isMathMode ? (
                    <div className="flex min-h-[52px] flex-1 items-center overflow-hidden rounded-2xl border border-white/10 bg-[#1c232c] px-4 py-3 text-white transition-colors focus-within:border-blue-400/50">
                      {React.createElement('math-field', {
                        ref: mathFieldRef,
                        onInput: (e: any) => setInput(e.target.value),
                        style: {
                          width: '100%',
                          fontSize: '1rem',
                          border: 'none',
                          outline: 'none',
                          background: 'transparent'
                        }
                      })}
                    </div>
                  ) : (
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend(input);
                        }
                      }}
                      placeholder="Ask about this lesson..."
                      className="min-h-[52px] min-w-0 flex-1 max-h-32 resize-none rounded-2xl border border-white/10 bg-[#1c232c] p-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-400/50 focus:outline-none custom-scrollbar"
                      rows={1}
                    />
                  )}
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl border border-blue-400/20 bg-[#20262e] text-blue-300 transition-all hover:scale-105 hover:border-blue-300/40 hover:bg-[#263241] disabled:opacity-50 disabled:hover:scale-100"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
};
