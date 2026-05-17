import React, { useState } from 'react';
import { BookOpen, ChevronDown, Edit2, Headphones, NotebookText, StickyNote, Wrench } from 'lucide-react';

type LessonToolsMenuProps = {
  canAdminEdit?: boolean;
  canOpenWorkspace?: boolean;
  onAddNote: () => void;
  onReadCurrent: () => void;
  onOpenWorkspace?: () => void;
  onAdminEdit?: () => void;
};

export const LessonToolsMenu: React.FC<LessonToolsMenuProps> = ({
  canAdminEdit = false,
  canOpenWorkspace = false,
  onAddNote,
  onReadCurrent,
  onOpenWorkspace,
  onAdminEdit,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="lesson-tools-menu">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="lesson-tools-menu__trigger"
        aria-expanded={open}
      >
        <Wrench size={16} />
        Tools
        <ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div className="lesson-tools-menu__panel">
          <button type="button" onClick={onReadCurrent} className="lesson-tools-menu__item">
            <Headphones size={16} />
            Read aloud
          </button>
          <button type="button" onClick={onAddNote} className="lesson-tools-menu__item">
            <StickyNote size={16} />
            Notes
          </button>
          {canOpenWorkspace && (
            <button type="button" onClick={onOpenWorkspace} className="lesson-tools-menu__item">
              <BookOpen size={16} />
              Extra help
            </button>
          )}
          {canAdminEdit && (
            <button type="button" onClick={onAdminEdit} className="lesson-tools-menu__item">
              <Edit2 size={16} />
              Admin edit
            </button>
          )}
          <div className="lesson-tools-menu__hint">
            <NotebookText size={14} />
            Select a word in the lesson for vocabulary help.
          </div>
        </div>
      )}
    </div>
  );
};
