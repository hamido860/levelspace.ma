import { describe, expect, it } from 'vitest';
import { getAcademicIdentity, matchesAcademicDimension } from './academicIdentity';
import { normalizeCurriculumValue } from './curriculumMatching';

describe('Moroccan academic identity', () => {
  const cases = [
    ['1ère année Bac', 'Sciences Expérimentales', 'BIOF'],
    ['1ère année Bac', 'Sciences Mathématiques', 'Arabic'],
    ['2ème année Bac', 'Sciences Physiques', 'BIOF'],
    ['2ème année Bac', 'Sciences Mathématiques A', 'Arabic'],
    ['Tronc Commun', 'Scientifique', 'Arabic'],
  ] as const;

  it.each(cases)('scopes %s / %s / %s independently', (gradeName, trackId, instructionOptionId) => {
    const identity = getAcademicIdentity({
      country: 'Morocco',
      gradeId: gradeName,
      gradeName,
      trackId,
      instructionOptionId,
      subjectId: 'Mathematics',
    });

    expect(identity.isBac).toBe(true);
    expect(identity.scopeKey).toContain(normalizeCurriculumValue(trackId));
    expect(identity.scopeKey).toContain(normalizeCurriculumValue(instructionOptionId));
  });

  it('keeps non-Bac collège behavior at grade + subject', () => {
    const identity = getAcademicIdentity({
      country: 'Morocco',
      gradeId: '3ac',
      gradeName: '3ème année collège',
      trackId: 'legacy-track',
      instructionOptionId: 'legacy-option',
      subjectId: 'math',
    });

    expect(identity.isBac).toBe(false);
    expect(identity.trackId).toBe('');
    expect(identity.instructionOptionId).toBe('');
  });

  it('allows shared rows but rejects rows for another selected dimension', () => {
    expect(matchesAcademicDimension(null, 'biof')).toBe(true);
    expect(matchesAcademicDimension('biof', 'biof')).toBe(true);
    expect(matchesAcademicDimension('arabic', 'biof')).toBe(false);
  });

  it('uses selected_option only as a legacy instruction fallback', () => {
    const identity = getAcademicIdentity({
      settings: {
        selected_country: 'Morocco',
        selected_grade: '2ème année Bac',
        selected_bac_track: 'sciences-physiques',
        selected_option: 'legacy-biof',
      },
    });

    expect(identity.instructionOptionId).toBe('legacy-biof');
  });
});
