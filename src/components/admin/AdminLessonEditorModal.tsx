import React, { useState } from 'react';
import { Modal } from '../Modal';
import { rewriteLessonContent, checkAIProvider } from '../../services/geminiService';
import { updateLesson } from '../../services/ragService';
import { db } from '../../db/db';
import { toast } from 'sonner';
import { getAdminApiHeaders } from '../../services/adminDashboardService';
import { Sparkles, Save, Loader2, RefreshCw } from 'lucide-react';

export interface AdminLessonEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: any | null; // Using any for quick integration; represents LessonTemplate / SupabaseLessonRow
  onSave: (updatedLesson: any) => void;
}

export const AdminLessonEditorModal: React.FC<AdminLessonEditorModalProps> = ({
  isOpen,
  onClose,
  lesson,
  onSave,
}) => {
  const [title, setTitle] = useState(lesson?.title || lesson?.lesson_title || '');
  const [content, setContent] = useState(lesson?.content || '');
  const [blocks, setBlocks] = useState<any[]>(lesson?.blocks || []);
  
  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when lesson prop changes
  React.useEffect(() => {
    if (lesson) {
      setTitle(lesson.title || lesson.lesson_title || '');
      
      let initialContent = lesson.content || '';
      
      // If the lesson has blocks but a short summary content, convert blocks to Markdown so they can be edited.
      if (lesson.blocks && Array.isArray(lesson.blocks) && lesson.blocks.length > 0) {
        setBlocks(lesson.blocks);
        const blocksMarkdown = lesson.blocks.map((block: any) => {
          let md = '';
          if (block.type && block.type !== 'simple_explanation') {
            md += `> **${block.type.toUpperCase().replace(/_/g, ' ')}**\n`;
          }
          if (block.title) {
            md += `### ${block.title}\n`;
          }
          if (block.content) {
            md += `${block.content}\n`;
          }
          return md.trim();
        }).filter(Boolean).join('\n\n---\n\n');

        // Only append or use blocks if they exist and contain something meaningful
        if (blocksMarkdown) {
           if (!initialContent || initialContent.length < 150) {
              initialContent = blocksMarkdown; // Replace dummy summary with actual blocks
           } else {
              initialContent = initialContent + "\n\n---\n\n" + blocksMarkdown; // Append
           }
        }
      } else {
        setBlocks([]);
      }
      
      setContent(initialContent);
      setAiPrompt('');
    }
  }, [lesson]);

  const handleAiAction = async () => {
    if (!checkAIProvider()) {
      toast.error('AI Provider not configured.');
      return;
    }
    
    if (!aiPrompt.trim()) {
      toast.error('Please enter a prompt for the AI.');
      return;
    }

    setIsAiProcessing(true);
    try {
      const response = await rewriteLessonContent(aiPrompt, content, title);
      
      if (response) {
        setContent(response);
        toast.success('Content updated via AI!');
      } else {
        toast.error('AI returned an empty response.');
      }
    } catch (error: any) {
      console.error('Error with AI action:', error);
      toast.error(`Failed: ${error?.message || 'AI request error'}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handlePresetAction = async (presetPrompt: string) => {
    if (!checkAIProvider()) {
      toast.error('AI Provider not configured.');
      return;
    }

    setIsAiProcessing(true);
    try {
      // If we're in block mode, concatenate blocks so the global AI has the latest content context
      let contextContent = content;
      if (blocks.length > 0) {
         contextContent = blocks.map(b => `${b.title ? '### ' + b.title + '\n' : ''}${b.content}`).join('\n\n');
      }

      const optimizedPrompt = `${presetPrompt}\n\nIMPORTANT: Use varied formatting like bulleted lists, tables, and varied Markdown elements where appropriate for the educational content.`;
      const response = await rewriteLessonContent(optimizedPrompt, contextContent, title);
      
      if (response) {
        setContent(response);
        setBlocks([]); // Global presets output standard markdown, so we drop blocks
        toast.success('Content updated via AI Preset! (Switched to Markdown mode)');
      } else {
        toast.error('AI returned an empty response.');
      }
    } catch (error: any) {
      console.error('Error with AI preset action:', error);
      toast.error(`Failed: ${error?.message || 'AI request error'}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleBlockAiRewrite = async (index: number) => {
    if (!checkAIProvider()) {
      toast.error('AI Provider not configured.');
      return;
    }
    
    const block = blocks[index];
    if (!block.content) return;

    setIsAiProcessing(true);
    try {
      const prompt = `You are an expert educator. Rewrite and improve the following specific section of a lesson. Maintain the educational focus and improve clarity, flow, and formatting.\n\nBlock Title: ${block.title || 'Untitled'}\n\nIMPORTANT: Use varied formatting like bulleted lists, tables, and varied Markdown elements where appropriate.`;
      const response = await rewriteLessonContent(prompt, block.content, title);
      if (response) {
        const newBlocks = [...blocks];
        newBlocks[index].content = response;
        setBlocks(newBlocks);
        toast.success('Block updated via AI!');
      }
    } catch (error: any) {
      console.error('Error rewriting block:', error);
      toast.error('Failed to rewrite block');
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!lesson?.id) return;
    
    setIsSaving(true);
    try {
      let contentToSave = content;
      if (blocks.length > 0) {
        contentToSave = blocks.map(b => `### ${b.title || ''}\n${b.content || ''}`).join('\n\n---\n\n');
      }

      // 1. Update Supabase via Admin API
      const updates = {
        lesson_id: lesson.id,
        lesson_title: title,
        content: contentToSave,
        blocks: blocks.length > 0 ? blocks : null,
        validation_status: 'teacher_reviewed',
        status: 'published'
      };
      
      const headers = await getAdminApiHeaders();
      const response = await fetch('/api/admin/lessons/update', {
        method: 'POST',
        headers,
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update Supabase database. Status: ${response.status}`);
      }

      // 2. Update IndexedDB
      try {
        await db.lessons.update(lesson.id, {
          title: title,
          content: contentToSave,
          blocks: blocks.length > 0 ? blocks : [],
          status: 'done'
        });
      } catch (localDbError: any) {
        console.warn('Could not update local IndexedDB cache, likely due to storage limits:', localDbError);
        toast.warning('Lesson saved online, but local cache update failed (storage full).');
      }

      // 3. Inform parent component
      toast.success('Lesson updated and validated successfully!');
      onSave({ ...lesson, title, lesson_title: title, content: contentToSave, blocks: blocks.length > 0 ? blocks : null, validation_status: 'teacher_reviewed' });
      onClose();
    } catch (error: any) {
      console.error('Error saving lesson:', error);
      toast.error(error.message || 'An error occurred while saving the lesson.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit & Validate Lesson" maxWidth="4xl">
      <div className="space-y-6">
        
        {/* Title Editor */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">Lesson Title</label>
          <input
            type="text"
            className="w-full rounded-md border border-border bg-background p-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Lesson Title"
          />
        </div>

        {/* Content / Blocks Editor */}
        {blocks.length > 0 ? (
          <div className="space-y-4 flex-grow">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-foreground">Lesson Blocks Editor</label>
              <button
                className="text-xs text-muted-foreground hover:text-destructive underline"
                onClick={() => {
                  if (confirm('Are you sure you want to convert these blocks into a single markdown document? You cannot undo this.')) {
                     const md = blocks.map(b => `### ${b.title || ''}\n${b.content || ''}`).join('\n\n---\n\n');
                     setContent(md);
                     setBlocks([]);
                  }
                }}
              >
                Convert to Single Document
              </button>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {blocks.map((block, index) => (
                <div key={index} className="border border-border rounded-lg p-4 bg-muted/10 space-y-3">
                  <div className="flex justify-between items-center">
                     <span className="text-xs font-semibold text-accent uppercase tracking-wider">{block.type?.replace(/_/g, ' ') || 'Block'}</span>
                     <button
                        onClick={() => handleBlockAiRewrite(index)}
                        disabled={isAiProcessing}
                        className="text-xs flex items-center gap-1.5 px-2 py-1 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50 font-medium"
                     >
                       <Sparkles size={12} />
                       AI Rewrite
                     </button>
                  </div>
                  <input
                    type="text"
                    className="w-full font-semibold rounded-md border border-border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                    value={block.title || ''}
                    onChange={(e) => {
                      const newBlocks = [...blocks];
                      newBlocks[index].title = e.target.value;
                      setBlocks(newBlocks);
                    }}
                    placeholder="Block Title"
                  />
                  <textarea
                    className="w-full h-[150px] font-mono text-sm rounded-md border border-border bg-background p-3 focus:outline-none focus:ring-1 focus:ring-accent resize-y"
                    value={block.content || ''}
                    onChange={(e) => {
                      const newBlocks = [...blocks];
                      newBlocks[index].content = e.target.value;
                      setBlocks(newBlocks);
                    }}
                    placeholder="Block Content"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2 flex-grow">
            <label className="block text-sm font-medium text-foreground">Lesson Content (Markdown)</label>
            <textarea
              className="w-full h-[400px] font-mono text-sm rounded-md border border-border bg-background p-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-y"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste or write markdown content here..."
            />
          </div>
        )}

        {/* Smart AI Block */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-accent font-medium">
            <Sparkles size={18} />
            <h3>Smart AI Provider</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Ask the AI to rewrite, simplify, or generate new content. The response will replace the content above.
          </p>
          
          <div className="flex flex-wrap gap-2 pt-1 pb-2">
            <button 
              onClick={() => handlePresetAction("You are an expert educator. Ignore any missing content and generate a comprehensive, highly educational lesson from scratch based strictly on the Lesson Title. Ensure the lesson is well-structured, engaging, and easy to understand.")}
              disabled={isAiProcessing || !title}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              🚀 Generate from Scratch
            </button>
            <button 
              onClick={() => handlePresetAction("You are an expert educator. Polish and clarify this lesson. Fix any grammar issues, improve the flow, and ensure the tone is engaging, accessible, and highly educational for students.")}
              disabled={isAiProcessing || !content.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
            >
              🪄 Polish & Clarify
            </button>
            <button 
              onClick={() => handlePresetAction("You are an expert educator. Expand on the provided lesson content. Take brief bullet points or short paragraphs and flesh them out with more depth, context, and detailed explanations while maintaining the original meaning.")}
              disabled={isAiProcessing || !content.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
            >
              📈 Expand Content
            </button>
            <button 
              onClick={() => handlePresetAction("You are an expert educator. Review the provided lesson content and identify key theoretical concepts. Insert relevant, real-world practical examples to illustrate these concepts clearly to students.")}
              disabled={isAiProcessing || !content.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
            >
              🎯 Add Examples
            </button>
            <button 
              onClick={() => handlePresetAction("You are an expert educator. Read the provided lesson content. Then, append 3 to 5 quick review questions (with answers provided below them) at the bottom of the lesson to test student comprehension.")}
              disabled={isAiProcessing || !content.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
            >
              📝 Add Quiz Questions
            </button>
            <button 
              onClick={() => handlePresetAction("Properly format the provided lesson content using GitHub Flavored Markdown. Organize it with clear hierarchical headers, bullet points, and bold emphasis for maximum readability. Do not change the underlying meaning.")}
              disabled={isAiProcessing || !content.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
            >
              ✨ Format as Markdown
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              className="flex-grow rounded-md border border-border bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Rewrite this lesson to be simpler for 1st grade students..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAiAction();
              }}
            />
            <button
              onClick={handleAiAction}
              disabled={isAiProcessing || !aiPrompt.trim()}
              className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {isAiProcessing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Ask AI
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save & Validate
          </button>
        </div>

      </div>
    </Modal>
  );
};
