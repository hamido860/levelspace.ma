import { normalizeCurriculumValue } from './curriculumMatching';

export type AcademicIdentitySettings = Record<string, unknown>;

export type AcademicIdentity = {
  country: string;
  gradeId: string;
  gradeName: string;
  trackId: string;
  instructionOptionId: string;
  subjectId: string;
  isBac: boolean;
  scopeKey: string;
};

type AcademicIdentityInput = {
  settings?: AcademicIdentitySettings | null;
  profile?: Record<string, unknown> | null;
  country?: unknown;
  gradeId?: unknown;
  gradeName?: unknown;
  trackId?: unknown;
  instructionOptionId?: unknown;
  subjectId?: unknown;
};

const clean = (value: unknown) => String(value ?? '').trim();
const firstNonEmpty = (...values: unknown[]) => values.map(clean).find(Boolean) || '';

export const isMoroccanBacIdentity = (country: unknown, gradeName: unknown) => {
  const normalizedCountry = normalizeCurriculumValue(clean(country));
  const normalizedGrade = normalizeCurriculumValue(clean(gradeName));
  const isMorocco = !normalizedCountry || normalizedCountry === 'morocco' || normalizedCountry === 'maroc';

  return isMorocco && (normalizedGrade.includes('bac') || normalizedGrade.includes('tronc commun'));
};

export const buildAcademicScopeKey = (identity: Omit<AcademicIdentity, 'scopeKey'>) => [
  normalizeCurriculumValue(identity.country),
  normalizeCurriculumValue(identity.gradeId || identity.gradeName),
  identity.isBac ? normalizeCurriculumValue(identity.trackId) : '',
  identity.isBac ? normalizeCurriculumValue(identity.instructionOptionId) : '',
  normalizeCurriculumValue(identity.subjectId),
].join(':');

export const getAcademicIdentity = ({
  settings = {},
  profile = {},
  country,
  gradeId,
  gradeName,
  trackId,
  instructionOptionId,
  subjectId,
}: AcademicIdentityInput = {}): AcademicIdentity => {
  const resolvedCountry = firstNonEmpty(country, settings?.selected_country, 'Morocco');
  const resolvedGradeId = firstNonEmpty(gradeId, settings?.selected_grade_id, profile?.grade_id, profile?.selected_grade_id);
  const resolvedGradeName = firstNonEmpty(gradeName, settings?.selected_grade, profile?.selected_grade);
  const resolvedTrackId = firstNonEmpty(trackId, settings?.selected_bac_track, profile?.track_id, profile?.selected_bac_track);
  const resolvedInstructionOptionId = firstNonEmpty(
    instructionOptionId,
    settings?.selected_bac_int_option,
    profile?.instruction_option_id,
    settings?.selected_option,
    profile?.selected_option,
  );
  const resolvedSubjectId = firstNonEmpty(subjectId, settings?.selected_subject_id, profile?.selected_subject_id);
  const isBac = isMoroccanBacIdentity(resolvedCountry, resolvedGradeName);
  const base = {
    country: resolvedCountry,
    gradeId: resolvedGradeId,
    gradeName: resolvedGradeName,
    trackId: isBac ? resolvedTrackId : '',
    instructionOptionId: isBac ? resolvedInstructionOptionId : '',
    subjectId: resolvedSubjectId,
    isBac,
  };

  return { ...base, scopeKey: buildAcademicScopeKey(base) };
};

export const matchesAcademicDimension = (rowValue: unknown, selectedValue: unknown) => {
  const row = clean(rowValue);
  const selected = clean(selectedValue);
  return !selected || !row || row === selected;
};
