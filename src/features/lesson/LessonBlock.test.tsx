import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonBlock } from './LessonBlock';
import type { DisplayedLessonBlock, PedagogicalPurpose } from './useDisplayedLessonBlocks';

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

const noop = vi.fn();

const renderLessonBlock = (item: DisplayedLessonBlock) =>
  render(
    <LessonBlock
      item={item}
      isViewed={false}
      reading={false}
      quizAnswered={{}}
      quizCorrect={{}}
      quizSelectedOption={{}}
      exerciseResult={{}}
      exerciseHintShown={{}}
      examResult={{}}
      examHintShown={{}}
      onQuizAnswer={noop}
      onExerciseSubmit={noop}
      onShowExerciseHint={noop}
      onExamSubmit={noop}
      onShowExamHint={noop}
    />
  );

const makeItem = (
  purpose: PedagogicalPurpose,
  block: any,
  overrides: Partial<DisplayedLessonBlock> = {}
): DisplayedLessonBlock => ({
  id: `block-${purpose}`,
  sourceIndex: 1,
  block,
  purpose,
  label: purpose,
  title: purpose === 'practice' ? 'Practice 1' : `${purpose} title`,
  preview: `${purpose} preview text`,
  domain: null,
  ...overrides,
});

const theoryPurposes: PedagogicalPurpose[] = ['objective', 'definition', 'key_idea', 'explanation', 'summary'];

describe('LessonBlock', () => {
  it.each(theoryPurposes)(
    'opens %s theory blocks by default',
    (purpose) => {
      renderLessonBlock(makeItem(purpose, { content: `${purpose} full lesson content` }));

      expect(screen.getByText(`${purpose} full lesson content`)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: new RegExp(`${purpose} title`, 'i') })).not.toBeInTheDocument();
      expect(document.querySelector('.lesson-reader-block__chevron')).not.toBeInTheDocument();
    }
  );

  it('opens practice blocks by default', () => {
    renderLessonBlock(
      makeItem('practice', {
        exercise: {
          question: 'Practice full question content',
          solution: 'Practice solution',
        },
      })
    );

    expect(screen.queryByRole('button', { name: /Practice 1/i })).not.toBeInTheDocument();
    expect(screen.getByText('Practice full question content')).toBeInTheDocument();
  });

  it('does not show preview instead of open assessment content', () => {
    renderLessonBlock(
      makeItem('practice', {
        exercise: {
          question: 'Hidden exercise question',
          solution: 'Exercise solution',
        },
      }, { preview: 'Try one focused exercise before continuing.' })
    );

    expect(screen.queryByText('Try one focused exercise before continuing.')).not.toBeInTheDocument();
    expect(screen.getByText('Hidden exercise question')).toBeInTheDocument();
  });

  it('does not toggle assessment blocks closed', () => {
    renderLessonBlock(
      makeItem('practice', {
        exercise: {
          question: 'Now solve the displayed practice question',
          solution: 'Practice solution',
        },
      })
    );

    expect(screen.queryByRole('button', { name: /Practice 1/i })).not.toBeInTheDocument();
    expect(screen.getByText('Now solve the displayed practice question')).toBeInTheDocument();
  });

  it('removes orphan markdown table separators from lesson text', () => {
    renderLessonBlock(
      makeItem('explanation', {
        content: 'Before the table\n\n|---|---|---|\n\nAfter the table',
      })
    );

    expect(screen.getByText('Before the table')).toBeInTheDocument();
    expect(screen.getByText('After the table')).toBeInTheDocument();
    expect(screen.queryByText('|---|---|---|')).not.toBeInTheDocument();
  });

  it('renders valid markdown tables instead of raw separators', () => {
    renderLessonBlock(
      makeItem('summary', {
        content: '| Type | Question |\n| --- | --- |\n| COD | Qui ? |',
      })
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('| --- | --- |')).not.toBeInTheDocument();
    expect(screen.getByText('COD')).toBeInTheDocument();
  });
});
