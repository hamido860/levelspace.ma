export const CURRICULUM_VALIDATION_STATUSES = [
  'unverified',
  'ai_generated',
  'source_matched',
  'teacher_reviewed',
  'official_validated',
  'rejected',
] as const;

export type CurriculumValidationStatus = (typeof CURRICULUM_VALIDATION_STATUSES)[number];

export const CURRICULUM_VALIDATION_LABELS: Record<CurriculumValidationStatus, string> = {
  unverified: 'Unverified',
  ai_generated: 'AI Generated',
  source_matched: 'Source Matched',
  teacher_reviewed: 'Teacher Reviewed',
  official_validated: 'Official Validated',
  rejected: 'Rejected',
};

export const CURRICULUM_VALIDATION_BADGE_CLASSES: Record<CurriculumValidationStatus, string> = {
  unverified: 'pill pill--warn',
  ai_generated: 'pill pill--warn',
  source_matched: 'pill pill--info',
  teacher_reviewed: 'pill pill--success',
  official_validated: 'pill pill--success',
  rejected: 'pill pill--danger',
};

const STUDENT_PREFERRED_STATUSES: CurriculumValidationStatus[] = [
  'official_validated',
  'teacher_reviewed',
];

const STUDENT_STATUS_RANK: Record<CurriculumValidationStatus, number> = {
  official_validated: 0,
  teacher_reviewed: 1,
  source_matched: 2,
  ai_generated: 3,
  unverified: 4,
  rejected: 5,
};

export const getCurriculumValidationStatus = (
  value: unknown,
  isAiGenerated = false,
): CurriculumValidationStatus => {
  const text = String(value || '').trim();
  if ((CURRICULUM_VALIDATION_STATUSES as readonly string[]).includes(text)) {
    return text as CurriculumValidationStatus;
  }

  return isAiGenerated ? 'ai_generated' : 'unverified';
};

export const getCurriculumValidationLabel = (value: unknown, isAiGenerated = false) =>
  CURRICULUM_VALIDATION_LABELS[getCurriculumValidationStatus(value, isAiGenerated)];

export const getCurriculumValidationBadgeClass = (value: unknown, isAiGenerated = false) =>
  CURRICULUM_VALIDATION_BADGE_CLASSES[getCurriculumValidationStatus(value, isAiGenerated)];

export const isStudentPreferredValidationStatus = (value: unknown, isAiGenerated = false) =>
  STUDENT_PREFERRED_STATUSES.includes(getCurriculumValidationStatus(value, isAiGenerated));

export const isRejectedValidationStatus = (value: unknown, isAiGenerated = false) =>
  getCurriculumValidationStatus(value, isAiGenerated) === 'rejected';

export const isDraftValidationStatus = (value: unknown, isAiGenerated = false) => {
  const status = getCurriculumValidationStatus(value, isAiGenerated);
  return !STUDENT_PREFERRED_STATUSES.includes(status) && status !== 'rejected';
};

export const compareCurriculumValidationForStudents = (
  left: { validation_status?: unknown; source_confidence?: number | null; is_ai_generated?: boolean },
  right: { validation_status?: unknown; source_confidence?: number | null; is_ai_generated?: boolean },
) => {
  const leftStatus = getCurriculumValidationStatus(left.validation_status, !!left.is_ai_generated);
  const rightStatus = getCurriculumValidationStatus(right.validation_status, !!right.is_ai_generated);
  const leftRank = STUDENT_STATUS_RANK[leftStatus];
  const rightRank = STUDENT_STATUS_RANK[rightStatus];

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return Number(right.source_confidence || 0) - Number(left.source_confidence || 0);
};

export const selectStudentFacingValidatedContent = <
  T extends { validation_status?: unknown; source_confidence?: number | null; is_ai_generated?: boolean }
>(
  items: T[] | null | undefined,
) => {
  const visible = (items || []).filter((item) => !isRejectedValidationStatus(item.validation_status, !!item.is_ai_generated));
  const preferred = visible.filter((item) =>
    isStudentPreferredValidationStatus(item.validation_status, !!item.is_ai_generated),
  );

  return {
    preferredOnly: preferred.length > 0 ? preferred.sort(compareCurriculumValidationForStudents) : [],
    fallback: visible.sort(compareCurriculumValidationForStudents),
    hasPreferred: preferred.length > 0,
  };
};
