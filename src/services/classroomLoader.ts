import type { Module } from '../db/db';

export type SupabaseSubjectRecord = {
  id: string;
  name?: string | null;
  code?: string | null;
  description?: string | null;
  category?: string | null;
  country?: string | null;
  grade?: string | null;
  level?: string | null;
  level_name?: string | null;
  [key: string]: unknown;
};

const normalize = (value: string) => value.trim().toLowerCase();

const deriveCategory = (subject: SupabaseSubjectRecord): string => {
  if (typeof subject.category === 'string' && subject.category.trim()) return subject.category.trim();
  if (typeof subject.level_name === 'string' && subject.level_name.trim()) return subject.level_name.trim();
  if (typeof subject.level === 'string' && subject.level.trim()) return subject.level.trim();
  return 'General';
};

const deriveDescription = (subject: SupabaseSubjectRecord): string => {
  if (typeof subject.description === 'string' && subject.description.trim()) return subject.description.trim();
  return 'Supabase curriculum subject';
};

export const mapSubjectsToModules = (subjects: SupabaseSubjectRecord[], now = Date.now()): Module[] => {
  const deduped = new Map<string, SupabaseSubjectRecord>();

  for (const subject of subjects) {
    if (!subject?.id || typeof subject.name !== 'string' || !subject.name.trim()) continue;
    const key = `${normalize(subject.name)}::${normalize(subject.code || '')}`;
    if (!deduped.has(key)) deduped.set(key, subject);
  }

  return Array.from(deduped.values()).map((subject) => ({
    id: String(subject.id),
    name: subject.name!.trim(),
    code: (subject.code || subject.name || 'SUBJ').toString().trim().toUpperCase(),
    description: deriveDescription(subject),
    category: deriveCategory(subject),
    progress: 0,
    selected: false,
    createdAt: now,
  }));
};

export const mergeModulesWithAiSuggestions = (base: Module[], ai: Module[]): Module[] => {
  const byKey = new Map<string, Module>();

  for (const module of [...base, ...ai]) {
    const key = `${normalize(module.name)}::${normalize(module.code || '')}`;
    if (!byKey.has(key)) byKey.set(key, module);
  }

  return Array.from(byKey.values());
};
