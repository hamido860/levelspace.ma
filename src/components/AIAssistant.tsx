import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, HelpCircle, BookOpen, Globe, Calculator, Type, Info, PenTool, Zap, Copy, Check } from 'lucide-react';
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
  aiAvailable?: boolean;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ lessonContent, strictRAG, subject, grade, aiAvailable = true }) => {
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

  const mathFieldRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handleOpenAIAssistant = (e: CustomEvent<{ initialInput?: string }>) => {
      setIsOpen(true);
      if (e.detail?.initialInput) {
        setIsMathMode(true);
        setInput(e.detail.initialInput);
        if (mathFieldRef.current) {
          mathFieldRef.current.value = e.detail.initialInput;
        }
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
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

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
        const moduleName = "Lesson Draft";

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
    { label: "Create lesson draft", icon: <PenTool size={14} />, prompt: "Can you create more detailed content for this lesson, including examples and deeper explanations?" },
    { label: "Explain a concept", icon: <HelpCircle size={14} />, prompt: "Can you explain the main concept of this lesson in simpler terms?" },
    { label: "Extend an idea", icon: <Sparkles size={14} />, prompt: "Can you extend on the ideas presented here and give me a real-world application?" },
    { label: "Create a question", icon: <BookOpen size={14} />, prompt: "Can you create a practice question based on this lesson to test my understanding?" },
    { label: "Explain in another language", icon: <Globe size={14} />, prompt: `Can you explain the main concepts of this lesson in another language (like French, Arabic, or Spanish) to help me understand better? My preferred interface language is ${language}.` }
  ];

  if (!mounted || !hasAccess) return null;

  if (!aiAvailable) {
    return createPortal(
      <div className="fixed bottom-6 right-6 z-50 group">
        <button
          disabled
          className="w-14 h-14 bg-surface-mid text-muted rounded-full shadow-xl flex items-center justify-center cursor-not-allowed opacity-60"
        >
          <MessageCircle size={24} />
        </button>
        <div className="absolute bottom-16 right-0 bg-ink text-paper text-xs px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
          Guided help requires API key
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
            className="fixed bottom-6 right-6 w-14 h-14 bg-accent text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-accent-hover hover:scale-105 transition-all z-50 group"
          >
            <MessageCircle size={24} className="group-hover:animate-pulse" />
            <div className="absolute -top-2 -right-2 w-4 h-4 bg-error rounded-full border-2 border-background" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 w-[380px] h-[600px] max-h-[80vh] bg-paper rounded-3xl shadow-2xl flex flex-col z-50 border border-ink/10 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-ink text-paper flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Guided Tutor</h3>
                  <p className="text-[10px] text-paper/60 uppercase tracking-widest">Grounded in this lesson</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-low custom-scrollbar">
              {messages.length === 0 && isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center text-accent">
                    <Loader2 size={32} className="animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-ink">Reviewing lesson...</h4>
                    <p className="text-xs text-muted max-w-[250px]">
                      I'm reading the material to see how I can best help you.
                    </p>
                  </div>
                </div>
              ) : messages.length === 0 ? null : (
                <>
                  {messages.map((msg, i) => (
                    <div 
                      key={i} 
                      className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === 'user' ? 'bg-ink text-white' : 'bg-accent/10 text-accent'
                      }`}>
                        {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                      </div>
                      <div className={`p-3 rounded-2xl max-w-[80%] text-sm relative group ${
                        msg.role === 'user' 
                          ? 'bg-ink text-white rounded-tr-sm' 
                          : 'bg-paper border border-ink/5 text-ink rounded-tl-sm shadow-sm'
                      }`}>
                        {msg.role === 'model' && (
                          <button
                            onClick={() => handleCopy(msg.parts[0].text, i)}
                            className="absolute -right-8 top-0 p-1.5 text-ink-muted hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy message"
                          >
                            {copiedId === i ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        )}
                        {msg.role === 'user' ? (
                          msg.parts[0].text
                        ) : (
                          <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-pre:bg-surface-mid dark:prose-pre:bg-surface-low prose-pre:text-ink dark:prose-pre:text-ink-secondary max-w-none">
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
                          className="flex items-center gap-3 p-2 bg-paper border border-ink/5 rounded-xl text-xs font-medium text-ink-secondary hover:border-accent/30 hover:text-accent transition-colors text-left max-w-[280px]"
                        >
                          <div className="text-[#f1681c] shrink-0">{action.icon}</div>
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {isLoading && messages.length > 1 && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">
                        <Bot size={14} />
                      </div>
                      <div className="p-4 bg-paper border border-ink/5 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-accent" />
                        <span className="text-xs text-muted">Preparing help...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="p-4 bg-paper border-t border-ink/5 shrink-0">
              <div className="flex items-center justify-center gap-2 mb-3 pb-3 border-b border-ink/5">
                {quickActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(action.prompt)}
                    className="w-8 h-8 rounded-lg bg-surface-low border border-ink/5 flex items-center justify-center text-ink-muted hover:text-accent hover:border-accent/30 hover:bg-accent-soft transition-all hover:scale-110 active:scale-95"
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
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        isMathMode 
                          ? 'bg-accent/10 text-accent' 
                          : 'text-muted hover:bg-surface-low hover:text-ink'
                      }`}
                    >
                      {isMathMode ? <Calculator size={12} /> : <Type size={12} />}
                      {isMathMode ? 'Math Mode' : 'Text Mode'}
                    </button>
                    {isMathMode && (
                      <div className="relative group flex items-center">
                        <Info size={14} className="text-muted hover:text-ink transition-colors cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-ink text-paper text-[10px] leading-relaxed rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
                          Type standard math notation (e.g., 1/2 for fractions, ^ for exponents) or use the virtual keyboard that appears when you click the input.
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  {isMathMode ? (
                    <div className="flex-1 min-h-[44px] bg-surface-low border border-ink/10 rounded-2xl overflow-hidden focus-within:border-accent/50 transition-colors flex items-center px-3 py-2">
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
                      placeholder="Get help with this lesson..."
                      className="flex-1 max-h-32 min-h-[44px] p-3 bg-surface-low border border-ink/10 rounded-2xl text-sm focus:outline-none focus:border-accent/50 resize-none custom-scrollbar"
                      rows={1}
                    />
                  )}
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="w-11 h-11 shrink-0 bg-accent text-white rounded-2xl flex items-center justify-center disabled:opacity-50 disabled:hover:scale-100 hover:scale-105 transition-all"
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
