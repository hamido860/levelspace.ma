/**
 * Shared utilities for the lesson reader feature.
 * Extracted to avoid duplication across LessonReader, LessonOutline, and LessonBlock.
 */

import type { PedagogicalPurpose } from './useDisplayedLessonBlocks';
import {
  Target,
  MessageSquare,
  Sparkles,
  Lightbulb,
  FileText,
  HelpCircle,
  Dumbbell,
  PenTool,
  ListChecks,
} from 'lucide-react';
import type { ElementType } from 'react';

// ---------------------------------------------------------------------------
// Lesson illustration helper
// ---------------------------------------------------------------------------

export const getLessonIllustration = (
  title: string | null | undefined,
  subject?: string | null | undefined
): string => {
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

// ---------------------------------------------------------------------------
// Purpose icon map
// ---------------------------------------------------------------------------

export type PurposeStyle = {
  icon: ElementType;
  bg: string;
  text: string;
};

export const PURPOSE_ICONS: Record<string, PurposeStyle> = {
  objective:   { icon: Target,      bg: 'bg-red-50 dark:bg-red-500/10',     text: 'text-red-600 dark:text-red-400' },
  example:     { icon: MessageSquare, bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  explanation: { icon: Sparkles,    bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400' },
  key_idea:    { icon: Lightbulb,   bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  definition:  { icon: FileText,    bg: 'bg-teal-50 dark:bg-teal-500/10',   text: 'text-teal-600 dark:text-teal-400' },
  quiz:        { icon: HelpCircle,  bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' },
  practice:    { icon: Dumbbell,    bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
  exam:        { icon: PenTool,     bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400' },
  summary:     { icon: ListChecks,  bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
};

/** Block-level icon (no bg/text wrapper needed) */
export const PURPOSE_BLOCK_ICONS: Record<PedagogicalPurpose, ElementType> = {
  objective:   Target,
  definition:  FileText,
  key_idea:    Lightbulb,
  explanation: FileText,
  example:     MessageSquare,
  practice:    Dumbbell,
  quiz:        HelpCircle,
  exam:        PenTool,
  summary:     ListChecks,
};

// ---------------------------------------------------------------------------
// Purpose label helper (French / bilingual)
// ---------------------------------------------------------------------------

export const getPurposeLabel = (purpose: string, label: string): string => {
  const l = label.toLowerCase();
  if (l.includes('objective') || l.includes('objectif')) return 'Objectif';
  if (l.includes('example') || l.includes('exemple')) return 'Exemple';
  if (l.includes('explanation') || l.includes('explication')) return 'Explication';
  if (l.includes('key') || l.includes('idée') || l.includes('idee')) return 'Idée Clé';
  if (l.includes('summary') || l.includes('conclusion') || l.includes('checkpoint')) return 'Conclusion';

  switch (purpose) {
    case 'objective':  return 'Objectif';
    case 'example':    return 'Exemple';
    case 'explanation': return 'Explication';
    case 'key_idea':   return 'Idée Clé';
    case 'summary':
    case 'checkpoint':
    case 'practice':
    case 'exam':
      return 'Conclusion';
    default: return label;
  }
};

// ---------------------------------------------------------------------------
// Block content extraction helper (shared read-text helper)
// ---------------------------------------------------------------------------

export const getBlockContentText = (block: any): string =>
  [
    block?.content,
    block?.question,
    block?.quiz?.question,
    block?.exercise?.question,
    block?.exercise?.prompt,
    block?.exam?.question,
  ]
    .filter(Boolean)
    .join('\n\n');

/**
 * Full read-aloud text for a block, including bullet points and rules.
 * Used by the speech synthesis / Karaoke feature in LessonReader.
 */
export const getBlockReadText = (item: { title: string; block: any }): string =>
  [
    item.title,
    item.block?.content,
    item.block?.question,
    item.block?.quiz?.question,
    item.block?.exercise?.question,
    item.block?.exercise?.prompt,
    item.block?.exam?.question,
    ...(Array.isArray(item.block?.points) ? item.block.points : []),
    ...(Array.isArray(item.block?.rules) ? item.block.rules : []),
  ]
    .filter(Boolean)
    .join('\n');

