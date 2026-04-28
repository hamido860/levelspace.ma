import test from 'node:test';
import assert from 'node:assert';
import { createClassroomCatalogSupabaseFirstWithDeps } from '../classroomCatalogCore';

test('keeps classroom loading available when optional AI fails', async () => {
  let cleared = 0;
  let saved = 0;

  const result = await createClassroomCatalogSupabaseFirstWithDeps(
    {
      loadFromSupabase: async () => [
        { id: 'sub-1', name: 'Mathematics', code: 'MATH', description: 'd', category: 'Mathematics', progress: 0, selected: false, createdAt: Date.now() },
        { id: 'sub-2', name: 'Physics', code: 'PHYS', description: 'd', category: 'Physics', progress: 0, selected: false, createdAt: Date.now() },
      ],
      clearModules: async () => {
        cleared += 1;
      },
      saveModules: async () => {
        saved += 1;
      },
    },
    {
      grade: 'Grade 12',
      generateAiSuggestions: async () => {
        throw new Error('AI key missing');
      },
    }
  );

  assert.strictEqual(result.supabaseModules.length, 2);
  assert.strictEqual(result.aiSuggestions.length, 0);
  assert.strictEqual(cleared, 1);
  assert.strictEqual(saved, 1);
});

test('does not require AI for free users to load classroom catalog', async () => {
  let cleared = 0;
  let saved = 0;

  const result = await createClassroomCatalogSupabaseFirstWithDeps(
    {
      loadFromSupabase: async () => [
        { id: 'sub-1', name: 'Biology', code: 'BIO', description: 'd', category: 'Biology', progress: 0, selected: false, createdAt: Date.now() },
      ],
      clearModules: async () => {
        cleared += 1;
      },
      saveModules: async () => {
        saved += 1;
      },
    },
    {
      grade: 'Grade 11',
    }
  );

  assert.strictEqual(result.supabaseModules.length, 1);
  assert.strictEqual(result.supabaseModules[0].name, 'Biology');
  assert.strictEqual(result.aiSuggestions.length, 0);
  assert.strictEqual(cleared, 1);
  assert.strictEqual(saved, 1);
});
