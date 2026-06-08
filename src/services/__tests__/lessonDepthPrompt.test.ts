import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('lesson generation prompts request substantial lesson depth', () => {
  const source = readFileSync(resolve(__dirname, '../geminiService.ts'), 'utf8');
  const seedBody = source.slice(
    source.indexOf('export const generateSeedLesson'),
    source.indexOf('export const generateLessonSuggestions'),
  );
  const fullLessonBody = source.slice(
    source.indexOf('const getLessonPrompt'),
    source.indexOf('function needsRefinement'),
  );

  assert.match(seedBody, /Target 8,000-12,000 characters total/);
  assert.match(seedBody, /v3-depth/);
  assert.doesNotMatch(seedBody, /under 3000 characters/);
  assert.doesNotMatch(seedBody, /concise introductory seed lesson/);

  assert.match(fullLessonBody, /Target 12,000-16,000 characters total/);
  assert.doesNotMatch(fullLessonBody, /under 8000 characters/);
});
