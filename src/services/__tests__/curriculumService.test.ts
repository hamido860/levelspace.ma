import test from 'node:test';
import assert from 'node:assert';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('curriculum service loads grades, subjects, and topics from Supabase only', async (t) => {
  const mockFrom = t.mock.fn((table: string) => {
    if (table === 'cycles') {
      return {
        select: t.mock.fn(() => Promise.resolve({
          data: [
            { id: 'cycle-college', name: 'middle', curricula: { country: 'Morocco' } },
            { id: 'cycle-primary', name: 'Primary', curricula: { country: 'Morocco' } },
          ],
          error: null,
        })),
      };
    }

    if (table === 'grades') {
      return {
        select: t.mock.fn(() => ({
          in: t.mock.fn((_column: string, ids: string[]) => {
            assert.deepStrictEqual(ids, ['cycle-college']);
            return Promise.resolve({
              data: [
                {
                  id: 'grade-1',
                  name: 'grade 7',
                  cycle_id: 'cycle-college',
                  cycles: { id: 'cycle-college', name: 'middle', curricula: { country: 'Morocco' } },
                },
                {
                  id: 'grade-primary',
                  name: '1ere annee primaire',
                  cycle_id: 'cycle-primary',
                  cycles: { id: 'cycle-primary', name: 'Primary', curricula: { country: 'Morocco' } },
                },
              ],
              error: null,
            });
          }),
        })),
      };
    }

    if (table === 'grade_subjects') {
      return {
        select: t.mock.fn(() => ({
          eq: t.mock.fn((_column: string, gradeId: string) => {
            assert.strictEqual(gradeId, 'grade-1');
            return Promise.resolve({
              data: [
                {
                  grade_id: 'grade-1',
                  subject_id: 'subject-math',
                  subjects: { id: 'subject-math', name: 'Mathematics', code: 'MATH', level_id: null },
                },
              ],
              error: null,
            });
          }),
        })),
      };
    }

    if (table === 'topics') {
      return {
        select: t.mock.fn(() => ({
          eq: t.mock.fn(() => ({
            eq: t.mock.fn(() => ({
              order: t.mock.fn(() => Promise.resolve({
                data: [
                  {
                    id: 'topic-1',
                    title: 'Linear equations',
                    grade_id: 'grade-1',
                    subject_id: 'subject-math',
                  },
                ],
                error: null,
              })),
            })),
          })),
        })),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  const supabaseUrl = pathToFileURL(resolve('src/db/supabase.ts')).href;
  t.mock.module(supabaseUrl, {
    namedExports: {
      supabase: {
        from: mockFrom,
      },
    },
  });

  const {
    getGrades,
    getSubjectsForGrade,
    getTopicsForGradeSubject,
  } = await import('../curriculumService.ts');

  const grades = await getGrades();
  assert.deepStrictEqual(grades.map((grade) => grade.id), ['grade-1']);

  const subjects = await getSubjectsForGrade('grade-1');
  assert.deepStrictEqual(subjects.map((subject) => subject.name), ['Mathematics']);

  const topics = await getTopicsForGradeSubject('grade-1', 'subject-math');
  assert.deepStrictEqual(topics.map((topic) => topic.title), ['Linear equations']);
});
