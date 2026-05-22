import { supabase } from '../db/supabase';

export type CurriculumCycle = {
  id: string;
  name: string;
  country?: string | null;
};

export type CurriculumGrade = {
  id: string;
  name: string;
  cycle_id?: string | null;
  cycle?: CurriculumCycle | null;
};

export type CurriculumSubject = {
  id: string;
  name: string;
  code?: string | null;
  level_id?: string | null;
};

export type CurriculumTopic = {
  id: string;
  title: string;
  grade_id: string;
  subject_id: string;
};

const isDev = () => import.meta.env.DEV;

const first = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const clean = (value: unknown) => String(value || '').trim();

const byName = <T extends { name: string }>(left: T, right: T) =>
  left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });

const normalizeGrade = (row: any): CurriculumGrade | null => {
  const id = clean(row?.id);
  const name = clean(row?.name);
  if (!id || !name) return null;

  const cycle = first(row?.cycles);
  const curriculum = first(cycle?.curricula);

  return {
    id,
    name,
    cycle_id: clean(row?.cycle_id) || clean(cycle?.id) || null,
    cycle: cycle?.id || cycle?.name
      ? {
          id: clean(cycle?.id),
          name: clean(cycle?.name) || 'Ungrouped',
          country: clean(curriculum?.country) || null,
        }
      : null,
  };
};

const normalizeSubject = (row: any): CurriculumSubject | null => {
  const id = clean(row?.id);
  const name = clean(row?.name);
  if (!id || !name) return null;

  return {
    id,
    name,
    code: clean(row?.code) || null,
    level_id: clean(row?.level_id) || null,
  };
};

export const getGrades = async (): Promise<CurriculumGrade[]> => {
  const { data, error } = await supabase
    .from('grades')
    .select('id, name, cycle_id, cycles(id, name, curricula(country))');

  if (error) throw error;

  const grades = (data || [])
    .map(normalizeGrade)
    .filter((grade): grade is CurriculumGrade => Boolean(grade))
    .sort(byName);

  if (isDev() && grades.length === 0) {
    console.warn('[onboarding curriculum] Supabase returned zero grades.');
  }

  return grades;
};

export const getSubjectsForGrade = async (gradeId: string): Promise<CurriculumSubject[]> => {
  const safeGradeId = clean(gradeId);
  if (!safeGradeId) return [];

  const { data, error } = await supabase
    .from('grade_subjects')
    .select('grade_id, subject_id, subjects(id, name, code, level_id)')
    .eq('grade_id', safeGradeId);

  if (error) throw error;

  const subjects = (data || [])
    .map((row: any) => normalizeSubject(first(row?.subjects)))
    .filter((subject): subject is CurriculumSubject => Boolean(subject))
    .sort(byName);

  if (isDev() && subjects.length === 0) {
    console.warn('[onboarding curriculum] No subjects configured for selected grade.', {
      gradeId: safeGradeId,
    });
  }

  return subjects;
};

export const getTopicsForGradeSubject = async (
  gradeId: string,
  subjectId: string,
): Promise<CurriculumTopic[]> => {
  const { data, error } = await supabase
    .from('topics')
    .select('id, title, grade_id, subject_id')
    .eq('grade_id', gradeId)
    .eq('subject_id', subjectId)
    .order('title', { ascending: true });

  if (error) throw error;

  return (data || [])
    .map((row: any) => ({
      id: clean(row.id),
      title: clean(row.title),
      grade_id: clean(row.grade_id),
      subject_id: clean(row.subject_id),
    }))
    .filter((topic) => topic.id && topic.title && topic.grade_id && topic.subject_id);
};

export const validateGradeSubjectPair = async (gradeId: string, subjectId: string) => {
  const { data, error } = await supabase
    .from('grade_subjects')
    .select('grade_id, subject_id')
    .eq('grade_id', gradeId)
    .eq('subject_id', subjectId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
};

export const debugVerifyOnboardingCurriculum = async (grade: CurriculumGrade) => {
  const subjects = await getSubjectsForGrade(grade.id);
  const rejectedStaleSubjects = ['Bio', 'Biology', 'SVT', 'Physics', 'Math', 'French', 'Arabic'].filter(
    (label) => !subjects.some((subject) => subject.name.toLowerCase() === label.toLowerCase()),
  );

  const result = {
    selectedGrade: { id: grade.id, name: grade.name },
    subjectsReturnedFromSupabase: subjects.map((subject) => ({ id: subject.id, name: subject.name })),
    rejectedStaleOrHardcodedSubjects: rejectedStaleSubjects,
  };

  if (isDev()) {
    console.info('[onboarding curriculum verification]', result);
  }

  return result;
};
