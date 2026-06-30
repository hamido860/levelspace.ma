import React, { useState } from 'react';
import { 
  X, 
  Target, 
  MessageSquare, 
  Sparkles, 
  Lightbulb, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight, 
  BookOpen, 
  FileText,
  HelpCircle,
  Dumbbell,
  PenTool,
  ListChecks
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import type { DisplayedLessonBlock } from './useDisplayedLessonBlocks';

const markdownPlugins = {
  remarkPlugins: [remarkMath, remarkGfm],
  rehypePlugins: [[rehypeKatex, { strict: false }]] as any,
};

type LessonOutlineProps = {
  blocks: DisplayedLessonBlock[];
  activeBlockId: string | null;
  viewedBlockIds: Set<string>;
  isOpen?: boolean;
  onClose?: () => void;
  onSelectBlock: (blockId: string) => void;
  lessonTitle?: string;
  subject?: string;
};

const PURPOSE_ICONS: Record<string, { icon: React.ElementType; bg: string; text: string }> = {
  objective: { icon: Target, bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
  example: { icon: MessageSquare, bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  explanation: { icon: Sparkles, bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400' },
  key_idea: { icon: Lightbulb, bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  definition: { icon: FileText, bg: 'bg-teal-50 dark:bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400' },
  quiz: { icon: HelpCircle, bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
  practice: { icon: Dumbbell, bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  exam: { icon: PenTool, bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400' },
  summary: { icon: ListChecks, bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
};

const getPurposeLabel = (purpose: string, label: string) => {
  const l = label.toLowerCase();
  if (l.includes('objective') || l.includes('objectif')) return 'Objectif';
  if (l.includes('example') || l.includes('exemple')) return 'Exemple';
  if (l.includes('explanation') || l.includes('explication')) return 'Explication';
  if (l.includes('key') || l.includes('idée') || l.includes('idee')) return 'Idée Clé';
  if (l.includes('summary') || l.includes('conclusion') || l.includes('checkpoint')) return 'Conclusion';
  
  switch (purpose) {
    case 'objective': return 'Objectif';
    case 'example': return 'Exemple';
    case 'explanation': return 'Explication';
    case 'key_idea': return 'Idée Clé';
    case 'summary':
    case 'checkpoint':
    case 'practice':
    case 'exam':
      return 'Conclusion';
    default: return label;
  }
};

const getContentText = (block: any) =>
  [
    block?.content,
    block?.question,
    block?.quiz?.question,
    block?.exercise?.question,
    block?.exercise?.prompt,
    block?.exam?.question,
  ].filter(Boolean).join('\n\n');

const getLessonIllustration = (title: string | null | undefined, subject?: string | null | undefined) => {
  const t = String(title || '').toLowerCase();
  const s = String(subject || '').toLowerCase();
  
  if (
    t.includes('math') || 
    t.includes('geom') || 
    t.includes('arith') || 
    t.includes('calcul') || 
    t.includes('algebra') || 
    t.includes('suite') || 
    t.includes('série') || 
    t.includes('analyse') || 
    s.includes('math')
  ) {
    return '/illustrations/math_geometry.png';
  }
  if (
    t.includes('physic') || 
    t.includes('physiq') || 
    t.includes('chem') || 
    t.includes('chim') || 
    t.includes('electr') || 
    t.includes('circuit') || 
    t.includes('combust') || 
    s.includes('phys') || 
    s.includes('chim')
  ) {
    return '/illustrations/physics_chemistry.png';
  }
  if (
    t.includes('svt') || 
    t.includes('earth') || 
    t.includes('life') || 
    t.includes('tecton') || 
    t.includes('plaqu') || 
    t.includes('séisme') || 
    t.includes('volcan') || 
    t.includes('roche') || 
    t.includes('géolog') || 
    t.includes('biolog') || 
    s.includes('svt') || 
    s.includes('vie')
  ) {
    return '/illustrations/earth_sciences.png';
  }
  if (
    t.includes('lang') || 
    t.includes('arab') || 
    t.includes('french') || 
    t.includes('franç') || 
    t.includes('read') || 
    t.includes('book') || 
    t.includes('littér') || 
    t.includes('philoso') || 
    t.includes('lexiq') || 
    t.includes('gramm') || 
    t.includes('ortho') || 
    t.includes('conju') || 
    s.includes('lang') || 
    s.includes('fr') || 
    s.includes('ar') || 
    s.includes('phil')
  ) {
    return '/illustrations/humanities_languages.png';
  }
  return '/illustrations/default_edu.png';
};

export const LessonOutline: React.FC<LessonOutlineProps> = (props) => {
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(props.activeBlockId || (props.blocks[0]?.id || null));

  React.useEffect(() => {
    if (props.activeBlockId) {
      setExpandedBlockId(props.activeBlockId);
    }
  }, [props.activeBlockId]);

  const viewedCount = props.blocks.filter(b => props.viewedBlockIds.has(b.id)).length;
  const totalBlocks = props.blocks.length;
  const progressPercent = totalBlocks > 0 ? Math.round((viewedCount / totalBlocks) * 100) : 0;
  const bannerImage = getLessonIllustration(props.lessonTitle, props.subject);

  if (props.isOpen) {
    const handleContinue = () => {
      if (props.blocks.length === 0) return;
      const currentIndex = props.blocks.findIndex(b => b.id === expandedBlockId);
      if (currentIndex !== -1 && currentIndex < props.blocks.length - 1) {
        const nextBlock = props.blocks[currentIndex + 1];
        setExpandedBlockId(nextBlock.id);
        props.onSelectBlock(nextBlock.id);
      } else {
        props.onClose?.();
      }
    };

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
        {/* Dark Backdrop */}
        <div 
          onClick={props.onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Premium Redesigned Modal Card */}
        <div 
          className="relative w-full max-w-xl bg-white dark:bg-paper rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-100 dark:border-white/5 animate-in zoom-in-95 slide-in-from-bottom-10 duration-500"
        >
          {/* Top Full-bleed Image Banner */}
          <div className="h-44 w-full relative bg-slate-100 dark:bg-surface-low shrink-0 overflow-hidden">
            <img 
              src={bannerImage}
              alt={props.lessonTitle || "Lesson"}
              className="w-full h-full object-cover"
            />
            {/* Tint Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-black/35 flex items-center justify-center px-8" />
            
            {/* Center Lesson Title */}
            <h2 className="absolute inset-0 flex items-center justify-center text-center font-display font-black text-2xl tracking-wide text-white drop-shadow-md uppercase px-8 select-none">
              {props.lessonTitle || "Lesson Outline"}
            </h2>

            {/* Glassmorphic Close Button */}
            <button 
              type="button" 
              onClick={props.onClose} 
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md transition-colors border border-white/10"
              aria-label="Close outline"
            >
              <X size={18} />
            </button>
          </div>

          {/* Progress Indicator Section */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 dark:bg-surface-low dark:border-white/5 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-slate-500 dark:text-ink-muted">
              Progress: {viewedCount} / {totalBlocks}
            </span>
            <div className="flex-1 max-w-[200px] ml-4 bg-slate-200 dark:bg-surface-mid h-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Accordion Blocks Scrollable List */}
          <div className="flex-grow overflow-y-auto px-6 py-4 space-y-2 no-scrollbar">
            {props.blocks.map((item, index) => {
              const isExpanded = expandedBlockId === item.id;
              const isViewed = props.viewedBlockIds.has(item.id);
              const purposeStyle = PURPOSE_ICONS[item.purpose] || PURPOSE_ICONS.explanation;
              const BlockIcon = purposeStyle.icon;
              const blockContent = getContentText(item.block);
              
              return (
                <div 
                  key={item.id}
                  className={`border border-slate-100 rounded-2xl dark:border-white/5 overflow-hidden transition-all ${
                    isExpanded 
                      ? 'bg-slate-50/30 border-[#007A87]/20 shadow-sm dark:bg-white/1' 
                      : 'hover:bg-slate-50/50 dark:hover:bg-white/3'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedBlockId(isExpanded ? null : item.id);
                      props.onSelectBlock(item.id);
                    }}
                    className="w-full py-3.5 px-4 flex items-center justify-between gap-4 text-left transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Round colorful icon */}
                      <div className={`w-8 h-8 rounded-full ${purposeStyle.bg} flex items-center justify-center shrink-0 ${purposeStyle.text}`}>
                        <BlockIcon size={15} />
                      </div>
                      <div className="min-w-0">
                        <h4 className={`text-sm font-bold leading-snug truncate ${isExpanded ? 'text-[#007A87] dark:text-accent' : 'text-slate-800 dark:text-ink'}`}>
                          {getPurposeLabel(item.purpose, item.title)}
                        </h4>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {isViewed && (
                        <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full dark:bg-emerald-500/10 dark:text-emerald-400">
                          ✓ viewed
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-400" />
                      )}
                    </div>
                  </button>
                  
                  {/* Expanded Body Content */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-1 text-xs text-slate-600 leading-relaxed dark:text-ink-secondary">
                          {item.purpose === 'example' ? (
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 font-medium text-slate-700 space-y-1.5 dark:bg-surface-low dark:border-white/5 dark:text-ink-secondary shadow-inner">
                              <Markdown {...markdownPlugins}>{blockContent}</Markdown>
                            </div>
                          ) : (
                            <div className="prose prose-sm max-w-none dark:prose-invert leading-relaxed pl-1">
                              <Markdown {...markdownPlugins}>{blockContent}</Markdown>
                            </div>
                          )}
                          
                          {/* Available status dot for conclusion / last block */}
                          {index === props.blocks.length - 1 && (
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                              <span className="text-[10px] text-slate-400 dark:text-ink-muted italic">Résumé de la leçon</span>
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#1B8354] dark:text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Available
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {props.blocks.length === 0 && (
              <div className="text-center py-12 text-slate-400 dark:text-ink-muted">
                No sections found in this lesson outline.
              </div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 dark:bg-surface-low dark:border-white/5 flex items-center justify-center shrink-0">
            <button 
              onClick={handleContinue}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-8 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10 hover:shadow-lg transition-all"
            >
              Continue <ChevronRight size={14} className="stroke-[3]" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop Permanent Sidebar Redesigned Layout Card
  const handleContinueSidebar = () => {
    if (props.blocks.length === 0) return;
    const currentIndex = props.blocks.findIndex(b => b.id === expandedBlockId);
    if (currentIndex !== -1 && currentIndex < props.blocks.length - 1) {
      const nextBlock = props.blocks[currentIndex + 1];
      setExpandedBlockId(nextBlock.id);
      props.onSelectBlock(nextBlock.id);
    }
  };

  return (
    <aside className="lesson-reader-outline w-full max-w-sm bg-white dark:bg-paper rounded-[2rem] shadow-md overflow-hidden flex flex-col border border-slate-200 dark:border-white/8 shrink-0 self-start sticky top-28 select-none">
      {/* Top Full-bleed Image Banner */}
      <div className="h-32 w-full relative bg-slate-100 dark:bg-surface-low shrink-0 overflow-hidden border-b border-slate-100 dark:border-white/5">
        <img 
          src={bannerImage}
          alt={props.lessonTitle || "Lesson"}
          className="w-full h-full object-cover"
        />
        {/* Tint Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-black/35 flex items-center justify-center px-4" />
        
        {/* Center Lesson Title */}
        <h2 className="absolute inset-0 flex items-center justify-center text-center font-display font-black text-xs tracking-wide text-white drop-shadow-md uppercase px-4 select-none">
          {props.lessonTitle || "Lesson Outline"}
        </h2>
      </div>

      {/* Progress Indicator Section */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 dark:bg-surface-low dark:border-white/5 flex items-center justify-between shrink-0">
        <span className="text-[10px] font-bold text-slate-500 dark:text-ink-muted">
          Progress: {viewedCount} / {totalBlocks}
        </span>
        <div className="flex-1 max-w-[120px] ml-3 bg-slate-200 dark:bg-surface-mid h-1.5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Accordion Blocks Scrollable List */}
      <div className="flex-grow overflow-y-auto px-4 py-3 space-y-1.5 max-h-[45vh] no-scrollbar">
        {props.blocks.map((item, index) => {
          const isExpanded = expandedBlockId === item.id;
          const isViewed = props.viewedBlockIds.has(item.id);
          const purposeStyle = PURPOSE_ICONS[item.purpose] || PURPOSE_ICONS.explanation;
          const BlockIcon = purposeStyle.icon;
          const blockContent = getContentText(item.block);
          
          return (
            <div 
              key={item.id}
              className={`border border-slate-100 rounded-2xl dark:border-white/5 overflow-hidden transition-all ${
                isExpanded 
                  ? 'bg-slate-50/30 border-[#007A87]/20 shadow-sm dark:bg-white/1' 
                  : 'hover:bg-slate-50/50 dark:hover:bg-white/3'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setExpandedBlockId(isExpanded ? null : item.id);
                  props.onSelectBlock(item.id);
                }}
                className="w-full py-2.5 px-3 flex items-center justify-between gap-3 text-left transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Round colorful icon */}
                  <div className={`w-7 h-7 rounded-full ${purposeStyle.bg} flex items-center justify-center shrink-0 ${purposeStyle.text}`}>
                    <BlockIcon size={13} />
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-xs font-bold leading-snug truncate ${isExpanded ? 'text-[#007A87] dark:text-accent' : 'text-slate-800 dark:text-ink'}`}>
                      {getPurposeLabel(item.purpose, item.title)}
                    </h4>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
                  {isViewed && (
                    <span className="text-[8px] font-extrabold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full dark:bg-emerald-500/10 dark:text-emerald-400">
                      ✓ viewed
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp size={14} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={14} className="text-slate-400" />
                  )}
                </div>
              </button>
              
              {/* Expanded Body Content */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 pt-0.5 text-[11px] text-slate-600 leading-relaxed dark:text-ink-secondary">
                      {item.purpose === 'example' ? (
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 font-medium text-slate-700 space-y-1 dark:bg-surface-low dark:border-white/5 dark:text-ink-secondary shadow-inner">
                          <Markdown {...markdownPlugins}>{blockContent}</Markdown>
                        </div>
                      ) : (
                        <div className="prose prose-sm max-w-none dark:prose-invert leading-relaxed pl-0.5">
                          <Markdown {...markdownPlugins}>{blockContent}</Markdown>
                        </div>
                      )}
                      
                      {/* Available status dot for conclusion / last block */}
                      {index === props.blocks.length - 1 && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                          <span className="text-[9px] text-slate-400 dark:text-ink-muted italic">Résumé de la leçon</span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#1B8354] dark:text-emerald-400">
                            <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                            Available
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {props.blocks.length === 0 && (
          <div className="text-center py-6 text-slate-400 dark:text-ink-muted text-xs">
            No sections found in outline.
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 dark:bg-surface-low dark:border-white/5 flex items-center justify-center shrink-0">
        <button 
          onClick={handleContinueSidebar}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg text-[10px] flex items-center justify-center gap-1 shadow-md shadow-blue-600/10 hover:shadow-lg transition-all"
        >
          Continue <ChevronRight size={12} className="stroke-[3]" />
        </button>
      </div>
    </aside>
  );
};
