import { useMemo } from 'react';
import { normalizeLessonBlockUiType } from '../../services/lessonRecovery';
import { normalizeCurriculumValue } from '../../services/curriculumMatching';
import { FRENCH_SUBJECT_DOMAINS } from '../../services/curriculumStructure';

export type LessonDomain = { code: string; name: string; order?: number };

export type PedagogicalPurpose =
  | 'objective'
  | 'definition'
  | 'key_idea'
  | 'explanation'
  | 'example'
  | 'practice'
  | 'quiz'
  | 'exam'
  | 'summary';

export type DisplayedLessonBlock = {
  id: string;
  sourceIndex: number;
  block: any;
  purpose: PedagogicalPurpose;
  label: string;
  title: string;
  preview: string;
  domain: LessonDomain | null;
};

export type LessonDomainStat = LessonDomain & { count: number };

const FRENCH_DOMAIN_KEYWORDS: Record<string, string[]> = {
  GRAMMAIRE: ['grammaire', 'phrase', 'sujet', 'verbe', 'complement', 'adjectif', 'nom', 'determinant', 'pronom', 'accord'],
  CONJUGAISON: ['conjugaison', 'conjuguer', 'verbe', 'temps', 'present', 'passe', 'futur', 'imparfait', 'conditionnel', 'subjonctif'],
  ORTHOGRAPHE: ['orthographe', 'orthograph', 'dictee', 'accent', 'homophone', 'accord', 'pluriel', 'singulier', 'majuscule'],
  LEXIQUE: ['lexique', 'vocabulaire', 'synonyme', 'antonyme', 'champ lexical', 'famille de mots', 'mot'],
  LECTURE: ['lecture', 'texte', 'comprehension', 'auteur', 'narrateur', 'recit', 'poeme', 'roman', 'extrait'],
  EXPRESSION_ECRITE: ['expression ecrite', 'production ecrite', 'redaction', 'paragraphe', 'introduction', 'conclusion', 'argument'],
  COMMUNICATION_ORALE: ['communication orale', 'oral', 'expose', 'debat', 'discussion', 'prendre la parole'],
};

const PURPOSE_LABELS: Record<PedagogicalPurpose, string> = {
  objective: 'Objective',
  definition: 'Definition',
  key_idea: 'Key idea',
  explanation: 'Explanation',
  example: 'Example',
  practice: 'Practice',
  quiz: 'Quick check',
  exam: 'Exam-style question',
  summary: 'Summary',
};

const normalizeSearchText = (value: string) =>
  normalizeCurriculumValue(value).replace(/\s+/g, ' ').trim();

const stripMarkdown = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[#>*_~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const truncateText = (text: string, max = 110) =>
  text.length <= max ? text : `${text.slice(0, max).trim()}...`;

const formatDomainName = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const normalizeDomainCode = (value: string) =>
  normalizeSearchText(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

const getBlockSearchText = (block: any) =>
  normalizeSearchText([
    block?.title,
    block?.label,
    block?.type,
    block?.content,
    block?.question,
    block?.quiz?.question,
    block?.exercise?.question,
    block?.exercise?.prompt,
    block?.exam?.question,
    ...(Array.isArray(block?.rules) ? block.rules : []),
    ...(Array.isArray(block?.points) ? block.points : []),
    ...(Array.isArray(block?.examples)
      ? block.examples.flatMap((example: any) => [example?.question, example?.answer, ...(Array.isArray(example?.steps) ? example.steps : [])])
      : []),
  ].filter(Boolean).join(' '));

const getExplicitBlockDomain = (block: any): LessonDomain | null => {
  const rawCode = String(block?.domain_code || block?.subject_domain_code || '').trim();
  const rawName = String(block?.domain_name || block?.subject_domain_name || block?.domain || block?.subject_domain || '').trim();
  const rawValue = rawCode || rawName;
  if (!rawValue) return null;

  const code = normalizeDomainCode(rawCode || rawName);
  if (!code) return null;

  const knownFrenchDomain = FRENCH_SUBJECT_DOMAINS.find((domain) => domain.code === code);
  return {
    code,
    name: rawName || knownFrenchDomain?.name || formatDomainName(rawCode || code),
    order: knownFrenchDomain?.order,
  };
};

const getBlockDomain = (block: any, isFrenchLesson: boolean): LessonDomain | null => {
  const explicitDomain = getExplicitBlockDomain(block);
  if (explicitDomain) return explicitDomain;

  if (!isFrenchLesson) return null;

  const text = getBlockSearchText(block);
  const matchedDomain = FRENCH_SUBJECT_DOMAINS.find((domain) => {
    const domainName = normalizeSearchText(domain.name);
    const keywords = FRENCH_DOMAIN_KEYWORDS[domain.code] || [];
    return text.includes(domainName) || keywords.some((keyword) => text.includes(normalizeSearchText(keyword)));
  }) || FRENCH_SUBJECT_DOMAINS.find((domain) => domain.code === 'LECTURE') || FRENCH_SUBJECT_DOMAINS[0];

  return matchedDomain ? { code: matchedDomain.code, name: matchedDomain.name, order: matchedDomain.order } : null;
};

const getPedagogicalPurpose = (block: any): PedagogicalPurpose => {
  const rawType = normalizeSearchText(String(block?.type || ''));
  const type = normalizeLessonBlockUiType(String(block?.type || ''));
  const text = normalizeSearchText([block?.title, block?.label, block?.type].filter(Boolean).join(' '));

  if (rawType === 'intro' || text.includes('objectif') || text.includes('objective') || text.includes('what you will learn')) return 'objective';
  if (rawType === 'definition' || text.includes('definition')) return 'definition';
  if (rawType === 'formula' || rawType === 'rules' || text.includes('key idea') || text.includes('idee cle')) return 'key_idea';
  if (type === 'example' || rawType === 'examples') return 'example';
  if (rawType === 'exercise' || rawType === 'practice') return 'practice';
  if (rawType === 'quiz' || rawType === 'checkpoint' || text.includes('check')) return 'quiz';
  if (rawType === 'exam') return 'exam';
  if (type === 'summary' || text.includes('summary') || text.includes('resume')) return 'summary';
  return 'explanation';
};

const getBlockTitle = (block: any, sourceIndex: number, purpose: PedagogicalPurpose) =>
  block?.title || block?.label || `${PURPOSE_LABELS[purpose]} ${sourceIndex + 1}`;

const getBlockPreview = (block: any) => {
  if (block?.question) return truncateText(stripMarkdown(String(block.question)));
  if (block?.quiz?.question) return truncateText(stripMarkdown(String(block.quiz.question)));
  if (block?.exercise?.question) return truncateText(stripMarkdown(String(block.exercise.question)));
  if (block?.exercise?.prompt) return truncateText(stripMarkdown(String(block.exercise.prompt)));
  if (block?.exam?.question) return truncateText(stripMarkdown(String(block.exam.question)));
  if (typeof block?.content === 'string' && block.content.trim()) return truncateText(stripMarkdown(block.content), 110);
  if (Array.isArray(block?.points) && block.points.length > 0) return truncateText(stripMarkdown(String(block.points[0])));
  if (Array.isArray(block?.rules) && block.rules.length > 0) return truncateText(stripMarkdown(String(block.rules[0])));
  if (Array.isArray(block?.examples) && block.examples.length > 0) {
    return truncateText(stripMarkdown(String(block.examples[0]?.question || block.examples[0]?.answer || '')));
  }
  return '';
};

export const useDisplayedLessonBlocks = ({
  blocks,
  activeDomain,
  isFrenchLesson,
}: {
  blocks: any[];
  activeDomain: string;
  isFrenchLesson: boolean;
}) =>
  useMemo(() => {
    const allBlocks: DisplayedLessonBlock[] = (blocks || []).map((block, sourceIndex) => {
      const purpose = getPedagogicalPurpose(block);
      return {
        id: `block-${sourceIndex}`,
        sourceIndex,
        block,
        purpose,
        label: PURPOSE_LABELS[purpose],
        title: getBlockTitle(block, sourceIndex, purpose),
        preview: getBlockPreview(block),
        domain: getBlockDomain(block, isFrenchLesson),
      };
    });

    const domainMap = new Map<string, LessonDomainStat>();
    for (const item of allBlocks) {
      if (!item.domain) continue;
      const existing = domainMap.get(item.domain.code);
      domainMap.set(item.domain.code, {
        ...item.domain,
        count: (existing?.count || 0) + 1,
      });
    }

    const domainStats = (isFrenchLesson
      ? FRENCH_SUBJECT_DOMAINS.map((domain) => ({
          code: domain.code,
          name: domain.name,
          order: domain.order,
          count: allBlocks.filter((item) => item.domain?.code === domain.code).length,
        }))
      : Array.from(domainMap.values()))
      .sort((left, right) => (left.order ?? 999) - (right.order ?? 999) || left.name.localeCompare(right.name));

    const displayedBlocks =
      activeDomain === 'all'
        ? allBlocks
        : allBlocks.filter((item) => item.domain?.code === activeDomain);

    return {
      allBlocks,
      displayedBlocks,
      domainStats,
      showDomainFilters: domainStats.length > 0,
    };
  }, [activeDomain, blocks, isFrenchLesson]);
