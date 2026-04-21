import test from 'node:test';
import assert from 'node:assert';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('submitQuizResult', async (t) => {
  const mockSingle = t.mock.fn(() => Promise.resolve({ data: { id: 'result-123' }, error: null }));
  const mockSelect = t.mock.fn(() => ({ single: mockSingle }));
  const mockInsert = t.mock.fn(() => ({ select: mockSelect }));
  const mockFrom = t.mock.fn((table: string) => {
    if (table === 'quiz_results') {
      return { insert: mockInsert };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  // Use pathToFileURL and resolve to create a dynamic file URL that works everywhere
  const supabaseUrl = pathToFileURL(resolve('src/db/supabase.ts')).href;

  t.mock.module(supabaseUrl, {
    namedExports: {
      supabase: {
        from: mockFrom,
      },
    },
  });

  const { submitQuizResult } = await import('../quizService.ts');

  await t.test('successfully submits quiz result', async () => {
    const result = {
      user_id: 'user-1',
      quiz_id: 'quiz-1',
      score: 80,
      total_questions: 10,
      xp_earned: 50,
      answers: { '1': 'a', '2': 'b' },
    };

    const data = await submitQuizResult(result as any);

    assert.deepStrictEqual(data, { id: 'result-123' });
    assert.strictEqual(mockFrom.mock.calls.length, 1);
    assert.strictEqual((mockFrom.mock.calls[0] as any).arguments[0], 'quiz_results');
    assert.strictEqual(mockInsert.mock.calls.length, 1);
    assert.deepStrictEqual((mockInsert.mock.calls[0] as any).arguments[0] as any, [result]);
  });

  await t.test('throws error when database insertion fails', async () => {
    const dbError = new Error('Database connection failed');
    mockSingle.mock.mockImplementationOnce(() => Promise.resolve({ data: null, error: dbError }));

    const result = {
      user_id: 'user-1',
      quiz_id: 'quiz-1',
      score: 80,
      total_questions: 10,
      xp_earned: 50,
      answers: { '1': 'a', '2': 'b' },
    };

    await assert.rejects(
      async () => {
        await submitQuizResult(result as any);
      },
      (err) => {
        assert.strictEqual(err, dbError);
        return true;
      }
    );
  });
});
