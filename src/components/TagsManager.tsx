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
    <div className="flex flex-wrap items-center gap-2">
      <AnimatePresence>
        {displayTags.map(tag => (
          <motion.div
            key={tag}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent"
          >
            <TagIcon className="h-3 w-3 opacity-70" />
            <span>{tag}</span>
            {!readonly && (
              <button 
                onClick={(e) => { e.stopPropagation(); onRemoveTag(tag); }}
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-error/10 hover:text-error"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {hiddenCount > 0 && (
        <span className="px-1 text-[10px] font-medium text-muted">
          +{hiddenCount} more
        </span>
      )}

      {!readonly && (
        <div className="relative flex items-center">
          {isAdding ? (
            <div className="flex items-center gap-1 rounded-full border border-ink/10 bg-paper px-3 py-1 shadow-sm">
              <input
                ref={inputRef}
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleAdd}
                placeholder="Add tag..."
                className="w-24 bg-transparent text-[10px] font-medium text-ink outline-none placeholder:text-muted/50"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setIsAdding(true); }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-ink/20 text-muted transition-all hover:border-accent/50 hover:bg-accent/5 hover:text-accent"
              title="Add Tag"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
