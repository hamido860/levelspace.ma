import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

it('lesson generation prompts request substantial lesson depth', () => {
  const source = readFileSync(resolve(__dirname, '../geminiService.ts'), 'utf8');
  const seedBody = source.slice(
    source.indexOf('export const generateSeedLesson'),
    source.indexOf('export const generateLessonSuggestions'),
  );
  const fullLessonBody = source.slice(
    source.indexOf('const getLessonPrompt'),
    source.indexOf('function needsRefinement'),
  );

  expect(seedBody).toMatch(/Target 8,000-12,000 characters total/);
  expect(seedBody).toMatch(/v3-depth/);
  expect(seedBody).not.toMatch(/under 3000 characters/);
  expect(seedBody).not.toMatch(/concise introductory seed lesson/);

  expect(fullLessonBody).toMatch(/Target 12,000-16,000 characters total/);
  expect(fullLessonBody).not.toMatch(/under 8000 characters/);
});
