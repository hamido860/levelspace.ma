import test from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(__dirname, '../..');
const forbiddenImport = 'moroccan_' + 'academic_db';

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);

const listSourceFiles = (directory: string): string[] => {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return listSourceFiles(path);
    }

    return sourceExtensions.has(extname(path)) ? [path] : [];
  });
};

test('source does not import the removed local Moroccan curriculum DB', () => {
  const offenders = listSourceFiles(srcRoot)
    .filter((path) => !path.endsWith('noLocalCurriculumDb.test.ts'))
    .filter((path) => readFileSync(path, 'utf8').includes(forbiddenImport));

  assert.deepStrictEqual(offenders, []);
});
