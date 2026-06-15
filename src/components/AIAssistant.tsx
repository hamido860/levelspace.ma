import React, { useState, useRef, useEffect, useMemo, useReducer } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Bot, User, Loader2, Copy, Check, Brain } from 'lucide-react';
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
import { detectLanguage, resolveExpectedLanguage, type LangCode } from '../mcp/languagePolicy';
import { TutorModeRenderer } from '../features/tutor/TutorModeRenderer';
import { buildExampleText, createFallbackQuizQuestion, createInitialTutorContext, tutorReducer } from '../features/tutor/tutorMachine';
import { extractTutorInstruction, mapStudentIntentToTutorEvent } from '../features/tutor/tutorIntent';
import type { TutorEvent, TutorUIInstruction } from '../features/tutor/types';

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
  country?: string;
  aiAvailable?: boolean;
}

type AssistantLang = LangCode | 'unknown';

const assistantCopy: Record<string, any> = {
  en: {
    fallbackGreeting: "How can I help you with this lesson? I can answer questions, explain concepts, or test your knowledge.",
    copied: "Copied to clipboard",
    generating: "I'm generating a comprehensive lesson for you. This might take a minute...",
    saved: (lessonTitle: string) => `I've generated and saved a new lesson titled **${lessonTitle}**. You can now ask questions about it!`,
    saveError: (lessonTitle: string) => `I generated the lesson **${lessonTitle}**, but there was an error saving it to the database.`,
    generateError: "Sorry, I failed to generate the lesson. Please try again.",
    error: "I'm sorry, I encountered an error. Please try again.",
    unavailable: "AI help requires API key",
    active: "AI SUPPORT ACTIVE",
    analyzingTitle: "Analyzing Lesson...",
    analyzingBody: "I'm reading the material to see how I can best help you.",
    thinking: "Thinking...",
    placeholder: "Ask about this lesson...",
    copyMessage: "Copy message",
    diagnosticTitle: "What is difficult?",
    diagnosticSubtitle: "Choose one. I will adapt the help from there.",
    diagnosticOptions: [
      ["Words", "The difficult part is the meaning of some words."],
      ["Sentence", "The difficult part is understanding the sentence."],
      ["Main idea", "The difficult part is the main idea of this section."],
      ["Example", "I need an example to understand this part."],
      ["Steps", "The difficult part is knowing the steps."],
      ["Not sure", "I am not sure what is difficult. Help me find it step by step."],
    ],
    actions: [
      ["Generate lesson content", "Can you generate more detailed content for this lesson, including examples and deeper explanations?"],
      ["Explain a concept", "Can you explain the main concept of this lesson in simpler terms?"],
      ["Extend an idea", "Can you extend on the ideas presented here and give me a real-world application?"],
      ["Generate a question", "Can you generate a practice question based on this lesson to test my understanding?"],
      ["Explain in another language", "Can you explain the main concepts of this lesson in another language to help me understand better?"],
    ],
  },
  fr: {
    fallbackGreeting: "Comment puis-je t'aider avec ce cours ? Je peux répondre à tes questions, expliquer des notions ou tester ta compréhension.",
    copied: "Copié dans le presse-papiers",
    generating: "Je génère un cours complet pour toi. Cela peut prendre une minute...",
    saved: (lessonTitle: string) => `J'ai généré et enregistré un nouveau cours intitulé **${lessonTitle}**. Tu peux maintenant poser des questions dessus !`,
    saveError: (lessonTitle: string) => `J'ai généré le cours **${lessonTitle}**, mais une erreur est survenue pendant l'enregistrement.`,
    generateError: "Désolé, je n'ai pas réussi à générer le cours. Réessaie.",
    error: "Désolé, une erreur est survenue. Réessaie.",
    unavailable: "L'aide IA nécessite une clé API",
    active: "SUPPORT IA ACTIF",
    analyzingTitle: "Analyse du cours...",
    analyzingBody: "Je lis le contenu pour voir comment t'aider au mieux.",
    thinking: "Réflexion...",
    placeholder: "Pose une question sur ce cours...",
    copyMessage: "Copier le message",
    diagnosticTitle: "Qu'est-ce qui bloque ?",
    diagnosticSubtitle: "Choisis une option. J'adapte l'aide ensuite.",
    diagnosticOptions: [
      ["Mots", "La difficulte vient du sens de certains mots."],
      ["Phrase", "La difficulte vient du sens de la phrase."],
      ["Idee", "La difficulte vient de l'idee principale de cette section."],
      ["Exemple", "J'ai besoin d'un exemple pour comprendre cette partie."],
      ["Etapes", "La difficulte vient des etapes a suivre."],
      ["Pas sur", "Je ne sais pas exactement ce qui bloque. Aide-moi a le trouver etape par etape."],
    ],
    actions: [
      ["Générer le cours", "Peux-tu générer un contenu plus détaillé pour ce cours, avec des exemples et des explications plus approfondies ?"],
      ["Expliquer une notion", "Peux-tu expliquer la notion principale de ce cours avec des mots plus simples ?"],
      ["Prolonger une idée", "Peux-tu développer les idées présentées ici et donner une application réelle ?"],
      ["Générer une question", "Peux-tu générer une question d'entraînement basée sur ce cours pour tester ma compréhension ?"],
      ["Expliquer autrement", "Peux-tu expliquer les notions principales de ce cours dans une autre langue pour m'aider à mieux comprendre ?"],
    ],
  },
  ar: {
    fallbackGreeting: "كيف يمكنني مساعدتك في هذا الدرس؟ يمكنني الإجابة عن الأسئلة أو شرح المفاهيم أو اختبار فهمك.",
    copied: "تم النسخ",
    generating: "أقوم بإنشاء درس كامل لك. قد يستغرق ذلك دقيقة...",
    saved: (lessonTitle: string) => `أنشأت درسا جديدا بعنوان **${lessonTitle}** وحفظته. يمكنك الآن طرح أسئلة عنه!`,
    saveError: (lessonTitle: string) => `أنشأت الدرس **${lessonTitle}**، لكن حدث خطأ أثناء الحفظ.`,
    generateError: "عذرا، لم أتمكن من إنشاء الدرس. حاول مرة أخرى.",
    error: "عذرا، حدث خطأ. حاول مرة أخرى.",
    unavailable: "تحتاج مساعدة الذكاء الاصطناعي إلى مفتاح API",
    active: "دعم الذكاء الاصطناعي نشط",
    analyzingTitle: "جار تحليل الدرس...",
    analyzingBody: "أقرأ المحتوى لأعرف كيف أساعدك بأفضل طريقة.",
    thinking: "جار التفكير...",
    placeholder: "اسأل عن هذا الدرس...",
    copyMessage: "نسخ الرسالة",
    diagnosticTitle: "ما الجزء الصعب؟",
    diagnosticSubtitle: "اختر خيارا واحدا، وسأكيف المساعدة بعد ذلك.",
    diagnosticOptions: [
      ["الكلمات", "الجزء الصعب هو معنى بعض الكلمات."],
      ["الجملة", "الجزء الصعب هو فهم الجملة."],
      ["الفكرة", "الجزء الصعب هو الفكرة الرئيسية في هذا الجزء."],
      ["مثال", "أحتاج إلى مثال كي أفهم هذا الجزء."],
      ["الخطوات", "الجزء الصعب هو معرفة الخطوات."],
      ["لست متأكدا", "لست متأكدا مما هو صعب. ساعدني على إيجاده خطوة بخطوة."],
    ],
    actions: [
      ["إنشاء محتوى الدرس", "هل يمكنك إنشاء محتوى أكثر تفصيلا لهذا الدرس مع أمثلة وشروحات أعمق؟"],
      ["شرح مفهوم", "هل يمكنك شرح المفهوم الرئيسي في هذا الدرس بطريقة أبسط؟"],
      ["توسيع فكرة", "هل يمكنك توسيع الأفكار المعروضة هنا وإعطاء تطبيق واقعي؟"],
      ["إنشاء سؤال", "هل يمكنك إنشاء سؤال تدريبي من هذا الدرس لاختبار فهمي؟"],
      ["شرح بلغة أخرى", "هل يمكنك شرح المفاهيم الرئيسية لهذا الدرس بلغة أخرى لمساعدتي على الفهم؟"],
    ],
  },
};

const resolveAssistantUiLanguage = (country?: string, subject?: string, lessonContent?: string, interfaceLanguage?: string): AssistantLang => {
  const policyLanguage = country && subject ? resolveExpectedLanguage(country, subject) : null;
  if (policyLanguage) return policyLanguage;
  const detected = lessonContent ? detectLanguage(lessonContent).dominant : 'unknown';
  if (detected !== 'unknown') return detected;
  return (interfaceLanguage as AssistantLang) || 'en';
};

export const AIAssistant: React.FC<AIAssistantProps> = ({ lessonContent, strictRAG, subject, grade, title, country, aiAvailable = true }) => {
  const { language } = useLanguage();
  const assistantLanguage = useMemo(
    () => resolveAssistantUiLanguage(country, subject, lessonContent, language),
    [country, subject, lessonContent, language]
  );
  const copy = assistantCopy[assistantLanguage] || assistantCopy.en;
  const { user, isAdmin } = useAuth();
  const { settings } = useAppSettings();
  const askAiAccess = settings.ask_ai_access || 'admin';
  const hasAccess = askAiAccess === 'all' || (askAiAccess === 'admin' && isAdmin);

  const [isOpen, setIsOpen] = useState(false);
  const [greetingFetched, setGreetingFetched] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [tutorContext, dispatchTutor] = useReducer(tutorReducer, createInitialTutorContext({
    currentSectionTitle: title,
    currentSectionText: lessonContent,
  }));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(copy.copied);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const [pendingInitialInput, setPendingInitialInput] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const dispatchTutorEvent = (event: TutorEvent) => {
    dispatchTutor(event);
  };

  const applyAssistantInstruction = (instruction: TutorUIInstruction) => {
    switch (instruction.ui_mode) {
      case 'diagnostic_mode':
        dispatchTutor({ type: 'ASK_HELP' });
        break;
      case 'explanation_mode':
        dispatchTutor({ type: 'REQUEST_EXPLANATION' });
        break;
      case 'example_mode':
        dispatchTutor({ type: 'REQUEST_EXAMPLE' });
        break;
      case 'quiz_mode':
        dispatchTutor({ type: 'START_QUIZ', question: instruction.question || createFallbackQuizQuestion(title) });
        break;
      case 'repair_mode':
        dispatchTutor({ type: 'NEED_REPAIR', feedback: instruction.assistantText || 'On reprend avec un indice.' });
        break;
      case 'summary_mode':
        dispatchTutor({ type: 'SUMMARIZE' });
        break;
      case 'reading_mode':
      default:
        dispatchTutor({ type: 'RESET_TO_READING' });
        break;
    }
  };

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
    generateProactiveGreeting(lessonContent, language, subject, grade, country)
      .then(greeting => {
        if (isMounted) setMessages([{ role: 'model', parts: [{ text: greeting }] }]);
      })
      .catch(() => {
        if (isMounted) setMessages([{ role: 'model', parts: [{ text: copy.fallbackGreeting }] }]);
      })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, [isOpen, greetingFetched, lessonContent, aiAvailable, language, subject, grade, country, copy.fallbackGreeting]);

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

  const handleSend = async (
    text: string,
    options?: { displayText?: string; tutorDirective?: string; skipIntent?: boolean; localResponse?: string }
  ) => {
    if (!text.trim() || isLoading) return;

    const visibleText = options?.displayText || text;
    const apiText = options?.tutorDirective
      ? `${text}\n\nTutor directive for this turn: ${options.tutorDirective}\nDo not mention this directive. Do not ask the student to clarify the selected option; act on it directly.`
      : text;

    const tutorIntent = options?.skipIntent ? null : mapStudentIntentToTutorEvent(apiText);
    const shouldShowUserMessage = tutorIntent?.type !== 'ASK_HELP';
    if (shouldShowUserMessage) {
      const userMessage: ChatMessage = { role: 'user', parts: [{ text: visibleText }] };
      setMessages(prev => [...prev, userMessage]);
    }
    setInput('');
    setIsLoading(true);

    if (tutorIntent) {
      if (tutorIntent.type === 'ASK_HELP') {
        dispatchTutorEvent({ ...tutorIntent, sectionTitle: title, sectionText: lessonContent });
      } else {
        dispatchTutorEvent(tutorIntent);
      }
    }

    if (options?.localResponse || tutorIntent?.type === 'ASK_HELP' || tutorIntent?.type === 'REQUEST_EXAMPLE') {
      const responseText = options?.localResponse
        || (tutorIntent?.type === 'REQUEST_EXAMPLE'
          ? buildExampleText(title)
          : 'On va trouver le blocage exact. Choisis ce qui bloque le plus.');
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
      setIsLoading(false);
      return;
    }

    try {
      // 1. Check if the user is asking to generate a full lesson
      const isGenerateRequest = apiText.toLowerCase().includes("generate") && apiText.toLowerCase().includes("lesson");

      if (isGenerateRequest) {
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: copy.generating }] }]);
        
        const selectedCountry = country || localStorage.getItem('selected_country') || '';
        const selectedGrade = grade || localStorage.getItem('selected_grade') || 'Grade 10';
        const selectedSubject = subject || "General";
        const moduleName = "AI Generated";

        const lesson = await generateFullLesson(apiText, selectedCountry, selectedGrade, selectedSubject, moduleName);
        
        if (lesson) {
          const saved = await saveLesson(lesson, user?.id, true);
          if (saved) {
             setMessages(prev => [...prev, { role: 'model', parts: [{ text: copy.saved(lesson.lesson_title) }] }]);
          } else {
             setMessages(prev => [...prev, { role: 'model', parts: [{ text: copy.saveError(lesson.lesson_title) }] }]);
          }
        } else {
           setMessages(prev => [...prev, { role: 'model', parts: [{ text: copy.generateError }] }]);
        }
      } else {
        // 2. Normal RAG flow
        const results = await searchLessons(text);
        let context = lessonContent; // Start with current lesson content
        
        if (results.length > 0) {
           context += "\n\nAdditional Context from Database:\n" + results.map(r => `Title: ${r.lesson_title}\nContent: ${r.content}`).join('\n\n');
        }

        const responseText = await chatWithTutor(apiText, context, messages, language, user?.id, !!strictRAG, subject, grade, country);
        const { instruction, displayText } = extractTutorInstruction(responseText);
        if (instruction) {
          applyAssistantInstruction(instruction);
        }
        const safeDisplayText = displayText.trim() || responseText;
        const modelMessage: ChatMessage = { role: 'model', parts: [{ text: safeDisplayText }] };
        setMessages(prev => [...prev, modelMessage]);
      }
    } catch (error) {
      const errorMessage: ChatMessage = { 
        role: 'model', 
        parts: [{ text: copy.error }] 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderTutorMode = (compact = false) => (
    <TutorModeRenderer
      context={tutorContext}
      compact={compact}
      isLoading={isLoading}
      onEvent={dispatchTutorEvent}
      onSendPrompt={handleSend}
    />
  );

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
          {copy.unavailable}
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
                  <p className="text-[11px] text-white/45 uppercase tracking-[0.18em] font-mono">{subject || "Lesson"} - {copy.active}</p>
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
                    <h4 className="font-bold text-white text-xl">{copy.analyzingTitle}</h4>
                    <p className="max-w-[320px] text-sm leading-relaxed text-slate-400">
                      {copy.analyzingBody}
                    </p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="mx-auto flex h-full min-h-[360px] max-w-[520px] flex-col justify-center">
                  <TutorModeRenderer
                    context={tutorContext}
                    isLoading={isLoading}
                    onEvent={dispatchTutorEvent}
                    onSendPrompt={handleSend}
                  />
                </div>
              ) : (
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
                            title={copy.copyMessage}
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

                  {isLoading && messages.length > 1 && (
                    <div className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
                        <Bot size={14} />
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-white/8 bg-[#20262e] p-4 shadow-sm">
                        <Loader2 size={14} className="animate-spin text-blue-300" />
                        <span className="text-xs text-slate-400">{copy.thinking}</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-white/10 bg-[#111820] px-6 py-5">
              {messages.length > 0 && tutorContext.currentMode !== 'reading_mode' && (
                <div className="mb-4 border-b border-white/10 pb-4">
                  {renderTutorMode(true)}
                </div>
              )}
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
                className="flex flex-col gap-2"
              >
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(input);
                      }
                    }}
                    placeholder={copy.placeholder}
                    className="min-h-[52px] min-w-0 flex-1 max-h-32 resize-none rounded-2xl border border-white/10 bg-[#1c232c] p-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-400/50 focus:outline-none custom-scrollbar"
                    rows={1}
                  />
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
