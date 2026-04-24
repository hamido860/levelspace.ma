
import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, Zap, PenTool, MessageSquare, Loader2, Send, RefreshCw, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { generateAIContent, determineModel, handleApiError } from '../../../services/geminiService';
import { ToolConfig } from '../config';
import { useAuth } from '../../../context/AuthContext';
import { useAppSettings } from '../../../context/AppSettingsContext';

interface AIToolProps {
  tool: ToolConfig;
  state: any;
  onChange: (state: any) => void;
  lessonContext: any;
  subjectId: string;
}

export const AITool: React.FC<AIToolProps> = ({ tool, state, onChange, lessonContext, subjectId }) => {
  const { isAdmin } = useAuth();
  const { settings } = useAppSettings();
  const askAiAccess = settings.ask_ai_access || 'admin';
  const hasAiAccess = askAiAccess === 'all' || (askAiAccess === 'admin' && isAdmin);

  const [input, setInput] = useState(state.input || '');
  const [response, setResponse] = useState(state.response || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateAIResponse = async () => {
    if (!input.trim() && tool.id !== 'notes-generator') return;
    
    setIsGenerating(true);
    try {
      let prompt = "";
      switch (tool.id) {
        case 'ai-explainer':
          prompt = `Explain the biological concept of "${input}" for a ${lessonContext.grade} student in ${lessonContext.country}. Use analogies and simple terms. Context: ${lessonContext.title}`;
          break;
        case 'notes-generator':
          prompt = `Generate a structured summary and key points for the lesson: "${lessonContext.title}". Content: ${lessonContext.content}. Include 3 flashcard-style Q&A pairs.`;
          break;
        case 'writing-assistant':
          prompt = `Analyze and improve the following text for clarity, grammar, and tone (academic but accessible): "${input}". Provide the improved version and a brief explanation of changes. Subject: ${subjectId}`;
          break;
        case 'argument-builder':
          prompt = `Help me build a structured philosophical argument for: "${input}". Provide a thesis, two supporting arguments with examples, and a conclusion. Detect any logical fallacies. Context: ${lessonContext.title}`;
          break;
        default:
          prompt = `As an AI study assistant, help me with: "${input}". Subject: ${subjectId}, Context: ${lessonContext.title}`;
      }

      const modelToUse = determineModel(prompt, lessonContext.content?.length || 0);

      const result = await generateAIContent({
        model: modelToUse,
        contents: prompt,
        config: {
          systemInstruction: "You are an expert educational AI tutor. Provide structured, clear, and encouraging responses. Use Markdown for formatting. Keep explanations concise but thorough."
        }
      }, "AITool");

      const text = result.text || "I'm sorry, I couldn't generate a response. Please try again.";
      setResponse(text);
      onChange({ ...state, input, response: text });
    } catch (error) {
      handleApiError(error, "AITool");
      setResponse("An error occurred while generating the response. Please check your connection and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (response) {
      navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const Icon = {
    'ai-assistant': Brain,
    'ai-explainer': Sparkles,
    'notes-generator': Zap,
    'writing-assistant': PenTool,
    'argument-builder': MessageSquare
  }[tool.id] || Brain;

  if (!hasAiAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-6">
        <div className="w-16 h-16 bg-accent/5 rounded-full flex items-center justify-center text-accent/40">
          <Brain className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-ink">AI Access Restricted</h3>
          <p className="text-sm text-muted max-w-xs mx-auto">
            This AI tool is currently restricted to administrators. Please contact your teacher or administrator for access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-accent">
          <Icon className="w-4 h-4" />
          <h3 className="text-sm font-bold uppercase tracking-widest">{tool.label}</h3>
        </div>
        {response && (
          <button
            onClick={handleCopy}
            className="p-2 bg-paper border border-ink/5 rounded-lg text-muted hover:text-accent transition-colors"
            title="Copy Response"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        )}
      </div>

      <div className="flex-grow flex flex-col gap-4 overflow-hidden">
        {/* Input Area */}
        {tool.id !== 'notes-generator' && (
          <div className="relative shrink-0">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                tool.id === 'ai-explainer' ? "Enter a concept to explain..." :
                tool.id === 'writing-assistant' ? "Paste your text to improve..." :
                tool.id === 'argument-builder' ? "Enter your thesis or topic..." :
                "How can I help you?"
              }
              className="w-full p-4 pr-12 bg-paper border border-ink/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent/20 transition-all shadow-sm resize-none h-24"
            />
            <button
              onClick={generateAIResponse}
              disabled={isGenerating || !input.trim()}
              className="absolute right-3 bottom-3 p-2 bg-accent text-white rounded-lg hover:bg-ink transition-all disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}

        {/* Response Area */}
        <div className="flex-grow bg-paper border border-ink/10 rounded-2xl p-6 shadow-inner overflow-y-auto no-scrollbar relative">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-muted">
              <div className="relative">
                <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full animate-pulse" />
                <Brain className="w-12 h-12 text-accent relative z-10 animate-bounce" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest animate-pulse">AI is thinking...</p>
            </div>
          ) : response ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-ink prose-headings:text-ink prose-strong:text-accent prose-code:text-accent prose-code:bg-accent/5 dark:prose-code:bg-accent/15 prose-code:px-1 prose-code:rounded">
              <ReactMarkdown>{response}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40">
              <Icon className="w-12 h-12 text-muted" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-ink">Ready to assist</p>
                <p className="text-[10px] text-muted uppercase tracking-widest">
                  {tool.id === 'notes-generator' ? "Click below to generate lesson summary" : "Enter your query above to begin"}
                </p>
              </div>
              {tool.id === 'notes-generator' && (
                <button
                  onClick={generateAIResponse}
                  className="px-6 py-3 bg-accent text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ink transition-all shadow-lg shadow-accent/20"
                >
                  Generate Summary
                </button>
              )}
            </div>
          )}
        </div>

        <div className="p-4 bg-accent/5 border border-accent/10 rounded-xl flex items-start gap-3">
          <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-ink">AI Tutor</p>
            <p className="text-[10px] text-muted leading-relaxed">
              Our AI is trained on educational content to provide accurate and helpful support. Always verify critical facts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
