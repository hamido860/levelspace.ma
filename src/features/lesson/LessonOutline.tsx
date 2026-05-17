import React from 'react';
import { X } from 'lucide-react';
import type { DisplayedLessonBlock } from './useDisplayedLessonBlocks';

type LessonOutlineProps = {
  blocks: DisplayedLessonBlock[];
  activeBlockId: string | null;
  viewedBlockIds: Set<string>;
  isOpen?: boolean;
  onClose?: () => void;
  onSelectBlock: (blockId: string) => void;
};

const OutlineList: React.FC<Omit<LessonOutlineProps, 'isOpen' | 'onClose'>> = ({
  blocks,
  activeBlockId,
  viewedBlockIds,
  onSelectBlock,
}) => (
  <nav className="lesson-reader-outline__list" aria-label="Lesson outline">
    {blocks.map((item, index) => (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelectBlock(item.id)}
        className={`lesson-reader-outline__item ${activeBlockId === item.id ? 'lesson-reader-outline__item--active' : ''}`}
      >
        <span className="lesson-reader-outline__index">{viewedBlockIds.has(item.id) ? '✓' : index + 1}</span>
        <span className="lesson-reader-outline__copy">
          <span className="lesson-reader-outline__label">{item.label}</span>
          <strong>{item.title}</strong>
        </span>
      </button>
    ))}
  </nav>
);

export const LessonOutline: React.FC<LessonOutlineProps> = (props) => {
  if (props.isOpen) {
    return (
      <div className="lesson-reader-drawer" role="dialog" aria-modal="true" aria-label="Lesson outline">
        <div className="lesson-reader-drawer__backdrop" onClick={props.onClose} />
        <aside className="lesson-reader-drawer__panel">
          <div className="lesson-reader-drawer__header">
            <div>
              <p className="lesson-reader-eyebrow">Outline</p>
              <h2 className="text-lg font-bold text-ink">Lesson sections</h2>
            </div>
            <button type="button" onClick={props.onClose} className="lesson-reader-icon-button" aria-label="Close outline">
              <X size={18} />
            </button>
          </div>
          <OutlineList
            blocks={props.blocks}
            activeBlockId={props.activeBlockId}
            viewedBlockIds={props.viewedBlockIds}
            onSelectBlock={(blockId) => {
              props.onSelectBlock(blockId);
              props.onClose?.();
            }}
          />
        </aside>
      </div>
    );
  }

  return (
    <aside className="lesson-reader-outline">
      <p className="lesson-reader-eyebrow">Outline</p>
      <OutlineList
        blocks={props.blocks}
        activeBlockId={props.activeBlockId}
        viewedBlockIds={props.viewedBlockIds}
        onSelectBlock={props.onSelectBlock}
      />
    </aside>
  );
};
