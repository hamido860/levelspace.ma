import { supabase } from "../db/supabase";
import { getCanonicalSubjectName, isSubjectDomainName } from "./curriculumStructure";
import { normalizeCurriculumValue } from "./curriculumMatching";

export type CurriculumDebugRow = {
  label: string;
  detail: string;
  count?: number;
  severity: "info" | "warning" | "danger";
};

export type CurriculumDebugReport = {
  duplicateSubjectNames: CurriculumDebugRow[];
  duplicateSubjectAliases: CurriculumDebugRow[];
  topicsWithoutDomain: CurriculumDebugRow[];
  domainsStoredAsSubjects: CurriculumDebugRow[];
};

const readRows = async <T>(label: string, query: Promise<{ data: T[] | null; error: { message: string } | null }>) => {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data || [];
};

const compact = (values: Array<string | null | undefined>) => values.map((value) => String(value || "").trim()).filter(Boolean);

export const loadCurriculumDebugReport = async (): Promise<CurriculumDebugReport> => {
  const [subjects, topics] = await Promise.all([
    readRows<any>("subjects", supabase.from("subjects").select("id, name, code").order("name")),
    readRows<any>("topics", supabase.from("topics").select("id, title, subject_id, domain_id, subjects(name)").order("title")),
  ]);

  const byNormalizedSubjectName = new Map<string, any[]>();
  for (const subject of subjects) {
    const key = normalizeCurriculumValue(subject.name || "");
    if (!key) continue;
    byNormalizedSubjectName.set(key, [...(byNormalizedSubjectName.get(key) || []), subject]);
  }

  const duplicateSubjectNames = Array.from(byNormalizedSubjectName.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({
      label: rows[0]?.name || key,
      detail: compact(rows.map((row) => `${row.name} (${row.id})`)).join(", "),
      count: rows.length,
      severity: "warning" as const,
    }));

  const byCanonicalAlias = new Map<string, any[]>();
  for (const subject of subjects) {
    if (isSubjectDomainName(subject.name)) continue;
    const canonical = getCanonicalSubjectName(subject.name);
    const key = normalizeCurriculumValue(canonical);
    byCanonicalAlias.set(key, [...(byCanonicalAlias.get(key) || []), subject]);
  }

  const duplicateSubjectAliases = Array.from(byCanonicalAlias.entries())
    .filter(([, rows]) => new Set(rows.map((row) => normalizeCurriculumValue(row.name || ""))).size > 1)
    .map(([key, rows]) => ({
      label: getCanonicalSubjectName(rows[0]?.name) || key,
      detail: compact(rows.map((row) => row.name)).join(" / "),
      count: rows.length,
      severity: "warning" as const,
    }));

  const topicsWithoutDomain = topics
    .filter((topic) => !topic.domain_id)
    .slice(0, 50)
    .map((topic) => ({
      label: topic.title || "Untitled topic",
      detail: `Subject: ${topic.subjects?.name || "Unknown"}`,
      severity: "info" as const,
    }));

  const domainsStoredAsSubjects = subjects
    .filter((subject) => isSubjectDomainName(subject.name))
    .map((subject) => ({
      label: subject.name,
      detail: `Subject row ${subject.id} should be a subject_domains row under Français.`,
      severity: "danger" as const,
    }));

  return {
    duplicateSubjectNames,
    duplicateSubjectAliases,
    topicsWithoutDomain,
    domainsStoredAsSubjects,
  };
};
