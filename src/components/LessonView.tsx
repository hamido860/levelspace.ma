import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Brain, 
  Sparkles, 
  BookOpen, 
  HelpCircle, 
  Target, 
  Dumbbell,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';

interface LessonViewProps {
  lesson: any;
}

const extractText = (node: any): string => {
  if (node.type === 'text') return node.value || '';
  if (node.children) return node.children.map(extractText).join('');
  return '';
};

const markdownComponents: any = {
  blockquote: ({ node, children, ...props }: any) => {
    const textContent = extractText(node).toLowerCase();
    
    let isExample = false;
    let isQuiz = false;
    let isNote = false;
    
    if (textContent.includes('example') || textContent.includes('exemple') || textContent.includes('مثال')) {
      isExample = true;
    } else if (textContent.includes('quiz') || textContent.includes('question') || textContent.includes('سؤال')) {
      isQuiz = true;
    } else if (textContent.includes('note') || textContent.includes('ملاحظة') || textContent.includes('remarque') || textContent.includes('important')) {
      isNote = true;
    }

    let bgClass = "bg-surface-low border-surface-mid";
    let icon = null;
    let titleClass = "text-ink";
    let label = "";

    if (isExample) {
      bgClass = "bg-amber-500/10 border-amber-500/20";
      icon = <Sparkles className="text-amber-500" size={16} />;
      titleClass = "text-amber-700 dark:text-amber-400";
      label = "Example";
    } else if (isQuiz) {
      bgClass = "bg-purple-500/10 border-purple-500/20";
      icon = <HelpCircle className="text-purple-500" size={16} />;
      titleClass = "text-purple-700 dark:text-purple-400";
      label = "Quiz";
    } else if (isNote) {
      bgClass = "bg-blue-500/10 border-blue-500/20";
      icon = <Info className="text-blue-500" size={16} />;
      titleClass = "text-blue-700 dark:text-blue-400";
      label = "Note";
    } else {
      // Default blockquote
      return (
        <blockquote className="border-l-4 border-accent/50 pl-4 py-1 my-4 text-ink-secondary italic bg-surface-low/50 rounded-r-lg" {...props}>
          {children}
        </blockquote>
      );
    }

    return (
      <div className={`my-6 p-5 rounded-2xl border ${bgClass} shadow-sm`}>
        {icon && (
          <div className={`flex items-center gap-2 font-bold mb-3 ${titleClass}`}>
            {icon}
            <span className="uppercase text-[11px] tracking-wider font-display">
              {label}
            </span>
          </div>
        )}
        <div className="text-sm leading-relaxed text-ink-secondary prose prose-sm max-w-none">
          {children}
        </div>
      </div>
    );
  },
  table: ({ node, children, ...props }: any) => (
    <div className="overflow-x-auto my-6 rounded-xl border border-surface-mid shadow-sm bg-paper">
      <table className="w-full text-left border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ node, children, ...props }: any) => (
    <th className="bg-surface-low border-b border-surface-mid p-4 font-bold text-ink" {...props}>
      {children}
    </th>
  ),
  td: ({ node, children, ...props }: any) => (
    <td className="p-4 border-b border-surface-mid text-ink-secondary last:border-b-0" {...props}>
      {children}
    </td>
  )
};

const AccordionMarkdownBlock = ({ content, index, isFirst }: { content: string, index: number, isFirst: boolean }) => {
  const [isOpen, setIsOpen] = useState(isFirst);
  const lines = content.split('\n');
  let title = `Section ${index + 1}`;
  let body = content;

  if (content.startsWith('## ')) {
    title = lines[0].replace(/^##\s+/, '').trim();
    body = lines.slice(1).join('\n');
  } else if (content.startsWith('# ')) {
    title = lines[0].replace(/^#\s+/, '').trim();
    body = lines.slice(1).join('\n');
  }

  if (!body.trim()) return null;

  // If it doesn't have a recognized heading (like the very first chunk without a heading), just render it normally without accordion
  if (!content.startsWith('## ') && !content.startsWith('# ')) {
    return (
      <div className="bg-paper p-8 rounded-xl border border-surface-mid shadow-sm mb-4">
        <div className="markdown-body prose prose-slate max-w-none text-ink-secondary">
          <ReactMarkdown 
            remarkPlugins={[remarkMath, remarkGfm]} 
            rehypePlugins={[rehypeKatex]}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-paper rounded-xl border border-surface-mid shadow-sm overflow-hidden mb-4 transition-all">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-8 py-5 flex items-center justify-between hover:bg-surface-low transition-colors"
      >
        <h2 className="text-xl font-bold text-ink text-left font-display">{title}</h2>
        <div className={`p-1.5 rounded-lg transition-colors ${isOpen ? 'bg-surface-mid text-ink' : 'bg-surface-low text-ink-muted'}`}>
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>
      
      {isOpen && (
        <div className="px-8 py-6 border-t border-surface-mid animate-in slide-in-from-top-2 duration-300">
          <div className="markdown-body prose prose-slate max-w-none text-ink-secondary">
             <ReactMarkdown 
               remarkPlugins={[remarkMath, remarkGfm]} 
               rehypePlugins={[rehypeKatex]}
               components={markdownComponents}
             >
               {body}
             </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

export const LessonView: React.FC<LessonViewProps> = ({ lesson }) => {
  const [activeTab, setActiveTab] = useState<'content' | 'quizzes' | 'exercises'>('content');
  const [openBlocks, setOpenBlocks] = useState<string[]>([]);

  if (!lesson) return null;

  const toggleBlock = (id: string) => {
    setOpenBlocks(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const contentParts = lesson.content ? lesson.content.split(/(?=^##\s)/m).filter((p: string) => p.trim()) : [];

  return (
    <div className="space-y-8">
      {/* Lesson Header */}
      <div className="bg-paper p-8 rounded-xl border border-surface-mid shadow-sm space-y-4">
        <div className="flex items-center gap-3 text-accent">
          <BookOpen size={20} />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">{lesson.subject} • {lesson.grade}</span>
        </div>
        <h1 className="text-3xl font-display font-bold text-ink tracking-tight">{lesson.lesson_title}</h1>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full bg-surface-mid text-[10px] font-bold text-ink-muted uppercase tracking-normal">{lesson.country}</span>
          {lesson.is_ai_generated && (
            <span className="px-3 py-1 rounded-full bg-accent/10 text-[10px] font-bold text-accent uppercase tracking-normal flex items-center gap-1">
              <Sparkles size={10} />
              AI Generated
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-surface-low border border-surface-mid rounded-2xl w-fit">
        {[
          { id: 'content', label: 'Lesson Content', icon: <BookOpen size={14} /> },
          { id: 'quizzes', label: 'Quizzes', icon: <HelpCircle size={14} /> },
          { id: 'exercises', label: 'Exercises', icon: <Dumbbell size={14} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-normal transition-all ${
              activeTab === tab.id 
                ? 'bg-ink text-paper shadow-sm' 
                : 'text-ink-muted hover:text-ink hover:bg-surface-mid'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'content' && (
          <div className="space-y-0">
            {contentParts.length > 0 ? (
              contentParts.map((part: string, index: number) => (
                <AccordionMarkdownBlock key={index} content={part} index={index} isFirst={index === 0} />
              ))
            ) : (
              <div className="bg-paper p-8 rounded-xl border border-surface-mid shadow-sm prose prose-slate max-w-none">
                <div className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>{lesson.content}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'quizzes' && (
          <div className="space-y-4">
            {lesson.quizzes && Array.isArray(lesson.quizzes) && lesson.quizzes.length > 0 ? (
              lesson.quizzes.map((quiz: any, idx: number) => (
                <div key={idx} className="bg-paper p-6 rounded-2xl border border-surface-mid shadow-sm space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0 text-xs font-bold">
                      {idx + 1}
                    </div>
                    <div className="space-y-4 flex-1">
                      <p className="text-sm font-semibold text-ink leading-relaxed">{quiz.question}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {quiz.options?.map((option: string, optIdx: number) => (
                          <div 
                            key={optIdx}
                            className={`p-4 rounded-xl border border-surface-mid text-xs font-medium transition-all ${
                              option === quiz.correct_answer ? 'bg-success/5 border-success/20 text-success' : 'bg-surface-low text-ink-muted'
                            }`}
                          >
                            {option}
                          </div>
                        ))}
                      </div>
                      <div className="p-4 bg-surface-low rounded-xl border border-surface-mid">
                        <p className="text-[10px] font-bold text-ink-muted uppercase tracking-normal mb-1">Explanation</p>
                        <p className="text-[11px] text-ink-secondary leading-relaxed">{quiz.explanation}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center bg-paper rounded-xl border border-solid border-surface-mid opacity-50">
                <p className="text-xs font-bold text-ink-muted uppercase tracking-normal">No quizzes defined for this lesson</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'exercises' && (
          <div className="space-y-4">
            {lesson.exercises && Array.isArray(lesson.exercises) && lesson.exercises.length > 0 ? (
              lesson.exercises.map((ex: any, idx: number) => (
                <div key={idx} className="bg-paper rounded-2xl border border-surface-mid shadow-sm overflow-hidden">
                  <button 
                    onClick={() => toggleBlock(`ex-${idx}`)}
                    className="w-full p-6 flex items-center justify-between hover:bg-surface-low transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center text-success shrink-0 text-xs font-bold">
                        {idx + 1}
                      </div>
                      <p className="text-sm font-bold text-ink text-left">{ex.title || `Exercise ${idx + 1}`}</p>
                    </div>
                    {openBlocks.includes(`ex-${idx}`) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  
                  {openBlocks.includes(`ex-${idx}`) && (
                    <div className="p-6 border-t border-surface-mid space-y-6 animate-in slide-in-from-top-2 duration-300">
                      <div className="prose prose-slate max-w-none text-sm text-ink-secondary">
                        <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                          {ex.question}
                        </ReactMarkdown>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="p-4 bg-success/5 rounded-xl border border-success/20">
                          <p className="text-[10px] font-bold text-success uppercase tracking-normal mb-2 flex items-center gap-2">
                            <Target size={12} />
                            Solution
                          </p>
                          <div className="text-[11px] text-ink-secondary leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                              {ex.solution}
                            </ReactMarkdown>
                          </div>
                        </div>
                        
                        {ex.hint && (
                          <div className="p-4 bg-accent/5 rounded-xl border border-accent/20">
                            <p className="text-[10px] font-bold text-accent uppercase tracking-normal mb-1 flex items-center gap-2">
                              <Brain size={12} />
                              Pedagogical Hint
                            </p>
                            <p className="text-[11px] text-ink-secondary leading-relaxed">{ex.hint}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-12 text-center bg-paper rounded-xl border border-solid border-surface-mid opacity-50">
                <p className="text-xs font-bold text-ink-muted uppercase tracking-normal">No exercises defined for this lesson</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
