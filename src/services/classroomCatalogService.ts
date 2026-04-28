import { db } from '../db/db';
import { supabase } from '../db/supabase';
import { ClassroomCatalogModule, createClassroomCatalogSupabaseFirstWithDeps } from './classroomCatalogCore';


const asUuid = (value?: string) => {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
};

const toModule = (subject: { id: string; name: string; code?: string | null }): ClassroomCatalogModule => ({
  id: subject.id,
  name: subject.name,
  code: subject.code || subject.name.slice(0, 8).toUpperCase(),
  description: `Curriculum classroom for ${subject.name}`,
  category: subject.name,
  progress: 0,
  selected: false,
  createdAt: Date.now(),
});

export const loadClassroomCatalogFromSupabase = async (params: {
  grade: string;
  selectedBacTrackId?: string;
}): Promise<ClassroomCatalogModule[]> => {
  const { grade, selectedBacTrackId } = params;

  const { data: grades, error: gradeError } = await supabase
    .from('grades')
    .select('id,name')
    .ilike('name', grade)
    .limit(5);

  if (gradeError || !grades || grades.length === 0) return [];

  const gradeIds = grades.map(g => g.id);
  const { data: gradeSubjects, error: gradeSubjectsError } = await supabase
    .from('grade_subjects')
    .select('subject_id')
    .in('grade_id', gradeIds);

  if (gradeSubjectsError || !gradeSubjects || gradeSubjects.length === 0) return [];

  const subjectIds = new Set(gradeSubjects.map(gs => gs.subject_id));

  if (asUuid(selectedBacTrackId)) {
    const { data: trackSubjects } = await supabase
      .from('bac_track_subjects')
      .select('subject_id')
      .eq('track_id', selectedBacTrackId);

    if (trackSubjects && trackSubjects.length > 0) {
      const allowed = new Set(trackSubjects.map(ts => ts.subject_id));
      for (const id of [...subjectIds]) {
        if (!allowed.has(id)) subjectIds.delete(id);
      }
    }
  }

  if (subjectIds.size === 0) return [];

  const { data: subjects, error: subjectsError } = await supabase
    .from('subjects')
    .select('id,name,code')
    .in('id', [...subjectIds]);

  if (subjectsError || !subjects || subjects.length === 0) return [];

  return subjects.map(toModule);
};

export const createClassroomCatalogSupabaseFirst = async (params: {
  grade: string;
  selectedBacTrackId?: string;
  generateAiSuggestions?: () => Promise<ClassroomCatalogModule[]>;
}) =>
  createClassroomCatalogSupabaseFirstWithDeps(
    {
      loadFromSupabase: loadClassroomCatalogFromSupabase,
      clearModules: () => db.modules.clear(),
      saveModules: (modules) => db.modules.bulkPut(modules),
    },
    params
  );
