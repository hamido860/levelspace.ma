import { normalizeCurriculumValue } from '../services/curriculumMatching';

export const SUPPORTED_CYCLES = ['Collège', 'Lycée'] as const;

export const SUPPORTED_GRADES = [
  '1ère année collège',
  '2ème année collège',
  '3ème année collège',
  'Tronc Commun',
  '1ère année Bac',
  '2ème année Bac',
] as const;

export const UNSUPPORTED_PRIMARY_GRADES = [
  '1ère année primaire',
  '2ème année primaire',
  '3ème année primaire',
  '4ème année primaire',
  '5ème année primaire',
  '6ème année primaire',
] as const;

export const SUPPORTED_SCOPE_EMPTY_MESSAGE =
  'Levelspace currently supports Collège and Lycée. Primary school support is not active yet.';

const SUPPORTED_CYCLE_KEYWORDS = [
  'college',
  'collège',
  'middle',
  'اعدادي',
  'الإعدادي',
  'الاعدادي',
  'lycee',
  'lycée',
  'high',
  'qualifiant',
  'taehili',
  'تاهيلي',
  'التاهيلي',
  'التأهيلي',
];

const UNSUPPORTED_CYCLE_KEYWORDS = [
  'primaire',
  'primary',
  'ابتدائي',
  'الإبتدائي',
  'الابتدائي',
];

const includesNormalizedKeyword = (normalizedValue: string, keyword: string) => {
  const normalizedKeyword = normalizeCurriculumValue(keyword);
  return Boolean(normalizedKeyword) && normalizedValue.includes(normalizedKeyword);
};

const SUPPORTED_GRADE_ALIASES = new Set([
  ...SUPPORTED_GRADES.map(normalizeCurriculumValue),
  '1ere annee college',
  '1ere college',
  '1eme annee college',
  'middle 1',
  'grade 7',
  '2eme annee college',
  '2eme college',
  'middle 2',
  'grade 8',
  '3eme annee college',
  '3eme college',
  'middle 3',
  'grade 9',
  'tronc commun',
  'tc',
  'seconde',
  'grade 10',
  '1ere annee bac',
  '1ere bac',
  'bac 1',
  'premiere',
  'grade 11',
  '2eme annee bac',
  '2eme bac',
  'bac 2',
  'terminale',
  'grade 12',
].map(normalizeCurriculumValue));

export const isUnsupportedPrimaryCycle = (cycleName?: string | null) => {
  const normalized = normalizeCurriculumValue(String(cycleName || ''));
  return UNSUPPORTED_CYCLE_KEYWORDS.some((keyword) => includesNormalizedKeyword(normalized, keyword));
};

export const isSupportedCycleName = (cycleName?: string | null) => {
  const normalized = normalizeCurriculumValue(String(cycleName || ''));
  if (!normalized || isUnsupportedPrimaryCycle(normalized)) return false;
  return SUPPORTED_CYCLE_KEYWORDS.some((keyword) => includesNormalizedKeyword(normalized, keyword));
};

export const isSupportedGradeName = (gradeName?: string | null) => {
  const normalized = normalizeCurriculumValue(String(gradeName || ''));
  if (!normalized) return false;
  if (UNSUPPORTED_PRIMARY_GRADES.some((grade) => normalizeCurriculumValue(grade) === normalized)) return false;
  if (UNSUPPORTED_CYCLE_KEYWORDS.some((keyword) => includesNormalizedKeyword(normalized, keyword))) return false;
  return SUPPORTED_GRADE_ALIASES.has(normalized);
};

export const isSupportedGrade = (gradeName?: string | null, cycleName?: string | null) => {
  if (isSupportedGradeName(gradeName)) return true;
  return isSupportedCycleName(cycleName);
};
