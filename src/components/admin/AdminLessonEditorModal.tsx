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
  
  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when lesson prop changes
  React.useEffect(() => {
    if (lesson) {
      setTitle(lesson.title || lesson.lesson_title || '');
      setContent(lesson.content || '');
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

  const handleSave = async () => {
    if (!lesson?.id) return;
    
    setIsSaving(true);
    try {
      // 1. Update Supabase via Admin API
      const updates = {
        lesson_id: lesson.id,
        lesson_title: title,
        content: content,
        blocks: null, // Clear old blocks so new markdown content is used
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
          content: content,
          blocks: [], // Clear old blocks locally as well
          status: 'done'
        });
      } catch (localDbError: any) {
        console.warn('Could not update local IndexedDB cache, likely due to storage limits:', localDbError);
        toast.warning('Lesson saved online, but local cache update failed (storage full).');
      }

      // 3. Inform parent component
      toast.success('Lesson updated and validated successfully!');
      onSave({ ...lesson, title, lesson_title: title, content, validation_status: 'teacher_reviewed' });
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

        {/* Content Editor */}
        <div className="space-y-2 flex-grow">
          <label className="block text-sm font-medium text-foreground">Lesson Content (Markdown)</label>
          <textarea
            className="w-full h-[400px] font-mono text-sm rounded-md border border-border bg-background p-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-y"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste or write markdown content here..."
          />
        </div>

        {/* Smart AI Block */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-accent font-medium">
            <Sparkles size={18} />
            <h3>Smart AI Provider</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Ask the AI to rewrite, simplify, or generate new content. The response will replace the content above.
          </p>
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
