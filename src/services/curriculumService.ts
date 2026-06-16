import { supabase } from '../db/supabase';

type MaybeArray<T> = T | T[] | null | undefined;

export type CurriculumCycle = {
  id: string;
  name: string;
  country?: string;
};

export type CurriculumGrade = {
  id: string;
  name: string;
  cycle_id?: string | null;
  grade_order?: number | null;
  cycle?: CurriculumCycle | null;
};

export type CurriculumSubject = {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
};

const first = <T,>(value: MaybeArray<T>): T | null => (Array.isArray(value) ? value[0] || null : value || null);

const normalizeGrade = (row: any): CurriculumGrade => {
  const cycle = first(row.cycles);
  const curriculum = first(cycle?.curricula);

  return {
    id: String(row.id),
    name: String(row.name || ''),
    cycle_id: row.cycle_id ? String(row.cycle_id) : null,
    grade_order: typeof row.grade_order === 'number' ? row.grade_order : null,
    cycle: cycle
      ? {
          id: String(cycle.id || row.cycle_id || ''),
          name: String(cycle.name || 'Other Grades'),
          country: String(curriculum?.country || 'Morocco'),
        }
      : null,
  };
};

const normalizeSubject = (row: any): CurriculumSubject => ({
  id: String(row.id),
  name: String(row.name || ''),
  code: row.code ? String(row.code) : null,
  description: row.description ? String(row.description) : null,
});

export const getGrades = async (): Promise<CurriculumGrade[]> => {
  const { data, error } = await supabase
    .from('grades')
    .select('id, name, cycle_id, grade_order, cycles(id, name, curricula(country))')
    .order('grade_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map(normalizeGrade).filter((grade) => grade.id && grade.name);
};

export const getSubjectsForGrade = async (gradeId: string): Promise<CurriculumSubject[]> => {
  const { data, error } = await supabase
    .from('grade_subjects')
    .select('subjects(id, name, code, description)')
    .eq('grade_id', gradeId);

  if (error) throw error;

  return (data || [])
    .map((row: any) => first(row.subjects))
    .filter(Boolean)
    .map(normalizeSubject)
    .filter((subject) => subject.id && subject.name);
};

export const validateGradeSubjectPair = async (gradeId: string, subjectId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('grade_subjects')
    .select('grade_id')
    .eq('grade_id', gradeId)
    .eq('subject_id', subjectId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
};

export const debugVerifyOnboardingCurriculum = async (grade: CurriculumGrade) => {
  if (!import.meta.env.DEV) return;
  const subjects = await getSubjectsForGrade(grade.id);
  if (subjects.length === 0) {
    console.warn('[onboarding] Selected grade has no linked subjects.', {
      gradeId: grade.id,
      gradeName: grade.name,
    });
  }
};
