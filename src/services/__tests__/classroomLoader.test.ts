import test from 'node:test';
import assert from 'node:assert';

import {
  mapSubjectsToModules,
  mergeModulesWithAiSuggestions,
  shouldRequestAiCurriculumSuggestions,
  getClassroomLoadPlan,
  shouldIncludeAiSuggestions,
} from '../classroomLoader.ts';

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

test('mapSubjectsToModules canonicalizes French aliases and excludes French domains', () => {
  const modules = mapSubjectsToModules([
    {
      id: '365f9068-99a0-4875-8699-3c12d4f69775',
      name: 'Français',
      code: 'FR',
    },
    {
      id: '85b33e27-f493-4803-a10e-5762ee435c93',
      name: 'Langue Française',
      code: 'FR_ALIAS',
    },
    {
      id: '9cfa4d3d-4904-497d-a362-03737dd78104',
      name: 'Grammaire',
      code: 'GRAMMAIRE',
    },
    {
      id: '50666429-29cc-49b8-abfb-dbbb59316555',
      name: 'Conjugaison',
      code: 'CONJUGAISON',
    },
  ], 123);

  assert.strictEqual(modules.length, 1);
  assert.strictEqual(modules[0].id, '365f9068-99a0-4875-8699-3c12d4f69775');
  assert.strictEqual(modules[0].name, 'Français');
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
      {
        id: 'supabase-fr',
        name: 'Français',
        code: 'FR',
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
      {
        id: 'ai-fr-alias',
        name: 'Langue Française',
        code: 'FR_ALIAS',
        description: 'AI duplicate',
        category: 'General',
        progress: 0,
        selected: false,
        createdAt: 2,
      },
    ]
  );

  assert.strictEqual(merged.length, 3);
  assert.strictEqual(merged[0].id, 'supabase-1');
  assert.strictEqual(merged[1].id, 'supabase-fr');
  assert.strictEqual(merged[2].id, 'ai-2');
});

test('shouldRequestAiCurriculumSuggestions keeps classroom loading Supabase-first', () => {
  assert.strictEqual(
    shouldRequestAiCurriculumSuggestions({ includeAiSuggestions: false, aiAvailable: true }),
    false,
    'Create My Classroom must not call AI when loading from Supabase',
  );

  assert.strictEqual(
    shouldRequestAiCurriculumSuggestions({ includeAiSuggestions: true, aiAvailable: false }),
    false,
    'AI should never block classroom loading when unavailable',
  );

  assert.strictEqual(
    shouldRequestAiCurriculumSuggestions({ includeAiSuggestions: true, aiAvailable: true }),
    true,
    'AI curriculum generation is optional suggestions only',
  );
});

test('getClassroomLoadPlan keeps free users on Supabase-first classroom loading', () => {
  assert.deepStrictEqual(
    getClassroomLoadPlan({ action: 'create_classroom', isPro: false }),
    { includeAiSuggestions: false },
  );

  assert.deepStrictEqual(
    getClassroomLoadPlan({ action: 'refresh_suggestions', isPro: false }),
    { includeAiSuggestions: false },
  );

  assert.deepStrictEqual(
    getClassroomLoadPlan({ action: 'refresh_suggestions', isPro: true }),
    { includeAiSuggestions: true },
  );
});


test('free users can create classroom without AI calls', () => {
  assert.strictEqual(shouldIncludeAiSuggestions('create_classroom', true), false);
  assert.strictEqual(shouldIncludeAiSuggestions('create_classroom', false), false);
});

test('AI suggestions are optional and only used for regenerate flow', () => {
  assert.strictEqual(shouldIncludeAiSuggestions('regenerate_suggestions', true), true);
  assert.strictEqual(shouldIncludeAiSuggestions('regenerate_suggestions', false), false);
});
