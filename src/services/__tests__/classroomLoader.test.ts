import test from 'node:test';
import assert from 'node:assert';

import { mapSubjectsToModules, mergeModulesWithAiSuggestions, shouldIncludeAiSuggestions } from '../classroomLoader.ts';

test('mapSubjectsToModules keeps UUID ids and does not require AI services', () => {
  const modules = mapSubjectsToModules([
    {
      id: 'd59d9488-124d-4758-a190-81e8e57bcaf5',
      name: 'Mathematics',
      code: 'MATH',
      description: 'Core algebra and analysis',
    },
    {
      id: 'accf9b72-5cb7-41b0-b11a-38f9d255a5bb',
      name: 'Physics',
      code: 'PHY',
    },
  ], 123);

  assert.strictEqual(modules.length, 2);
  assert.deepStrictEqual(modules[0], {
    id: 'd59d9488-124d-4758-a190-81e8e57bcaf5',
    name: 'Mathematics',
    code: 'MATH',
    description: 'Core algebra and analysis',
    category: 'General',
    progress: 0,
    selected: false,
    createdAt: 123,
  });
  assert.strictEqual(modules[1].id, 'accf9b72-5cb7-41b0-b11a-38f9d255a5bb');
  assert.strictEqual(modules[1].description, 'Supabase curriculum subject');
});

test('mergeModulesWithAiSuggestions keeps Supabase modules and appends unique AI suggestions', () => {
  const merged = mergeModulesWithAiSuggestions(
    [
      {
        id: 'supabase-1',
        name: 'Mathematics',
        code: 'MATH',
        description: 'From Supabase',
        category: 'General',
        progress: 0,
        selected: false,
        createdAt: 1,
      },
    ],
    [
      {
        id: 'ai-duplicate',
        name: 'Mathematics',
        code: 'MATH',
        description: 'AI duplicate',
        category: 'General',
        progress: 0,
        selected: false,
        createdAt: 2,
      },
      {
        id: 'ai-2',
        name: 'Data Science',
        code: 'DATA',
        description: 'AI suggestion',
        category: 'General',
        progress: 0,
        selected: false,
        createdAt: 2,
      },
    ]
  );

  assert.strictEqual(merged.length, 2);
  assert.strictEqual(merged[0].id, 'supabase-1');
  assert.strictEqual(merged[1].id, 'ai-2');
});


test('free users can create classroom without AI calls', () => {
  assert.strictEqual(shouldIncludeAiSuggestions('create_classroom', true), false);
  assert.strictEqual(shouldIncludeAiSuggestions('create_classroom', false), false);
});

test('AI suggestions are optional and only used for regenerate flow', () => {
  assert.strictEqual(shouldIncludeAiSuggestions('regenerate_suggestions', true), true);
  assert.strictEqual(shouldIncludeAiSuggestions('regenerate_suggestions', false), false);
});
