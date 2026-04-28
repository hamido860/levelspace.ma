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
  ChevronUp
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface LessonViewProps {
  lesson: any;
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

  return (
    <div className="space-y-8">
      {/* Lesson Header */}
      <div className="bg-paper p-8 rounded-3xl border border-surface-mid shadow-sm space-y-4">
        <div className="flex items-center gap-3 text-accent">
          <BookOpen size={20} />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">{lesson.subject} • {lesson.grade}</span>
        </div>
        <h1 className="text-3xl font-display font-bold text-ink tracking-tight">{lesson.lesson_title}</h1>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full bg-surface-mid text-[10px] font-bold text-ink-muted uppercase tracking-widest">{lesson.country}</span>
          {lesson.is_ai_generated && (
            <span className="px-3 py-1 rounded-full bg-accent/10 text-[10px] font-bold text-accent uppercase tracking-widest flex items-center gap-1">
              <Sparkles size={10} />
              Lesson draft
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
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeTab === tab.id 
                ? 'bg-ink text-paper shadow-lg' 
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
          <div className="bg-paper p-8 rounded-3xl border border-surface-mid shadow-sm prose prose-slate max-w-none">
            <div className="markdown-body">
              <ReactMarkdown 
                remarkPlugins={[remarkMath]} 
                rehypePlugins={[rehypeKatex]}
              >
                {lesson.content}
              </ReactMarkdown>
            </div>
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
                        <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest mb-1">Explanation</p>
                        <p className="text-[11px] text-ink-secondary leading-relaxed">{quiz.explanation}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center bg-paper rounded-3xl border border-dashed border-surface-mid opacity-50">
                <p className="text-xs font-bold text-ink-muted uppercase tracking-widest">No quizzes defined for this lesson</p>
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
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {ex.question}
                        </ReactMarkdown>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="p-4 bg-success/5 rounded-xl border border-success/20">
                          <p className="text-[10px] font-bold text-success uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Target size={12} />
                            Solution
                          </p>
                          <div className="text-[11px] text-ink-secondary leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {ex.solution}
                            </ReactMarkdown>
                          </div>
                        </div>
                        
                        {ex.hint && (
                          <div className="p-4 bg-accent/5 rounded-xl border border-accent/20">
                            <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1 flex items-center gap-2">
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
              <div className="p-12 text-center bg-paper rounded-3xl border border-dashed border-surface-mid opacity-50">
                <p className="text-xs font-bold text-ink-muted uppercase tracking-widest">No exercises defined for this lesson</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
