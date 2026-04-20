import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Tag as TagIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TagsManagerProps {
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  maxDisplay?: number;
  readonly?: boolean;
}

export const TagsManager: React.FC<TagsManagerProps> = ({ 
  tags = [], 
  onAddTag, 
  onRemoveTag, 
  maxDisplay = 7,
  readonly = false
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleAdd = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onAddTag(trimmed);
    }
    setNewTag('');
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      setNewTag('');
      setIsAdding(false);
    }
  };

  const displayTags = tags.slice(0, maxDisplay);
  const hiddenCount = tags.length - maxDisplay;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <AnimatePresence>
        {displayTags.map(tag => (
          <motion.div
            key={tag}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent rounded text-[8px] font-mono uppercase tracking-widest border border-accent/20"
          >
            <TagIcon className="w-2.5 h-2.5 opacity-70" />
            <span>{tag}</span>
            {!readonly && (
              <button 
                onClick={(e) => { e.stopPropagation(); onRemoveTag(tag); }}
                className="ml-0.5 hover:text-error transition-colors p-0.5 rounded-full hover:bg-error/10"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {hiddenCount > 0 && (
        <span className="text-[8px] font-mono text-muted px-1">
          +{hiddenCount} more
        </span>
      )}

      {!readonly && (
        <div className="relative flex items-center">
          {isAdding ? (
            <div className="flex items-center gap-1 bg-paper border border-ink/10 rounded px-1.5 py-0.5 shadow-sm">
              <input
                ref={inputRef}
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleAdd}
                placeholder="Add tag..."
                className="bg-transparent text-[8px] font-mono outline-none w-16 text-ink placeholder:text-muted/50"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setIsAdding(true); }}
              className="inline-flex items-center justify-center w-5 h-5 rounded border border-dashed border-ink/20 text-muted hover:text-accent hover:border-accent/50 hover:bg-accent/5 transition-all"
              title="Add Tag"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
