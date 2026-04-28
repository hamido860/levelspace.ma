import type { Module } from "../db/db";
import { supabase } from "../db/supabase";

type SubjectRow = {
  id: string;
  name: string;
  code: string | null;
};

const inferCategory = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes("math") || n.includes("chim") || n.includes("phys") || n.includes("svt")) return "Science";
  if (n.includes("hist") || n.includes("geo") || n.includes("éco") || n.includes("econo")) return "Humanities";
  if (n.includes("lang") || n.includes("fran") || n.includes("arab") || n.includes("english")) return "Languages";
  return "General";
};

export const mapSubjectsToModules = (subjects: SubjectRow[]): Module[] => {
  return subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    code: subject.code ?? subject.name.slice(0, 8).toUpperCase(),
    description: `Supabase curriculum unit for ${subject.name}.`,
    category: inferCategory(subject.name),
    progress: 0,
    selected: false,
    createdAt: Date.now(),
  }));
};

type SupabaseClientLike = {
  from: (table: string) => any;
};

export const loadModulesFromSupabase = async (
  gradeName: string,
  bacTrackId?: string,
  supabaseClient: SupabaseClientLike = supabase
): Promise<Module[]> => {
  const { data: grades, error: gradeError } = await supabaseClient
    .from("grades")
    .select("id")
    .ilike("name", gradeName)
    .limit(1);

  if (gradeError) throw gradeError;
  const gradeId = grades?.[0]?.id;
  if (!gradeId) return [];

  const { data: gradeSubjects, error: gsError } = await supabaseClient
    .from("grade_subjects")
    .select("subject_id")
    .eq("grade_id", gradeId);
  if (gsError) throw gsError;

  let allowedSubjectIds = (gradeSubjects || []).map((x: any) => x.subject_id);
  if (allowedSubjectIds.length === 0) return [];

  if (bacTrackId) {
    const { data: trackSubjects, error: tsError } = await supabaseClient
      .from("bac_track_subjects")
      .select("subject_id")
      .eq("track_id", bacTrackId);
    if (tsError) throw tsError;
    const trackSet = new Set((trackSubjects || []).map((x: any) => x.subject_id));
    allowedSubjectIds = allowedSubjectIds.filter((id) => trackSet.has(id));
    if (allowedSubjectIds.length === 0) return [];
  }

  const { data: subjects, error: subjectsError } = await supabaseClient
    .from("subjects")
    .select("id, name, code")
    .in("id", allowedSubjectIds);
  if (subjectsError) throw subjectsError;

  return mapSubjectsToModules((subjects || []) as SubjectRow[]);
};

export const loadClassroomModulesSupabaseFirst = async (params: {
  gradeName: string;
  bacTrackId?: string;
  includeAiSuggestions?: boolean;
  loadAiSuggestions?: () => Promise<Module[]>;
  supabaseClient?: SupabaseClientLike;
}): Promise<Module[]> => {
  const { gradeName, bacTrackId, includeAiSuggestions = false, loadAiSuggestions, supabaseClient } = params;

  let supabaseModules: Module[] = [];
  try {
    supabaseModules = await loadModulesFromSupabase(gradeName, bacTrackId, supabaseClient);
  } catch (error) {
    console.warn("[classroomService] Supabase module load failed:", error);
  }

  if (!includeAiSuggestions || !loadAiSuggestions) {
    return supabaseModules;
  }

  try {
    const aiSuggestions = await loadAiSuggestions();
    if (aiSuggestions.length === 0) return supabaseModules;

    const existingNames = new Set(supabaseModules.map((m) => m.name.toLowerCase()));
    const uniqueAi = aiSuggestions.filter((m) => !existingNames.has(m.name.toLowerCase()));
    return [...supabaseModules, ...uniqueAi];
  } catch (error) {
    console.warn("[classroomService] AI suggestions failed:", error);
    return supabaseModules;
  }
};
