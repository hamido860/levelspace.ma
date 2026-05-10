import type { Module } from "../db/db";
import { normalizeCurriculumValue } from "./curriculumMatching";

export const FRENCH_CANONICAL_SUBJECT = "Français";
export const FRENCH_SUBJECT_ALIASES = ["Français", "Langue Française", "French", "French Language"];

export const FRENCH_SUBJECT_DOMAINS = [
  { code: "GRAMMAIRE", name: "Grammaire", order: 10 },
  { code: "CONJUGAISON", name: "Conjugaison", order: 20 },
  { code: "ORTHOGRAPHE", name: "Orthographe", order: 30 },
  { code: "LEXIQUE", name: "Lexique", order: 40 },
  { code: "LECTURE", name: "Lecture", order: 50 },
  { code: "EXPRESSION_ECRITE", name: "Expression écrite", order: 60 },
  { code: "COMMUNICATION_ORALE", name: "Communication orale", order: 70 },
] as const;

const FRENCH_ALIAS_KEYS = new Set(FRENCH_SUBJECT_ALIASES.map(normalizeCurriculumValue));
const FRENCH_DOMAIN_KEYS = new Set(FRENCH_SUBJECT_DOMAINS.map((domain) => normalizeCurriculumValue(domain.name)));

export const getCanonicalSubjectName = (name: string | null | undefined) => {
  const normalized = normalizeCurriculumValue(String(name || ""));
  return FRENCH_ALIAS_KEYS.has(normalized) ? FRENCH_CANONICAL_SUBJECT : String(name || "").trim();
};

export const isSubjectDomainName = (name: string | null | undefined) =>
  FRENCH_DOMAIN_KEYS.has(normalizeCurriculumValue(String(name || "")));

export const shouldShowAsDashboardSubject = (subject: { name?: string | null }) =>
  Boolean(getCanonicalSubjectName(subject.name)) && !isSubjectDomainName(subject.name);

export const canonicalModuleKey = (module: Pick<Module, "name" | "code">) =>
  normalizeCurriculumValue(getCanonicalSubjectName(module.name) || module.code);
