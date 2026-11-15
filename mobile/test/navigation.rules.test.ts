import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(__dirname, '..');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return name.endsWith('.tsx') && !name.endsWith('.test.tsx') ? [full] : [];
  });
}

function filesMatching(pattern: RegExp): string[] {
  return [...tsxFiles(join(ROOT, 'src')), ...tsxFiles(join(ROOT, 'app'))]
    .filter((file) => pattern.test(readFileSync(file, 'utf8')))
    .map((file) => relative(ROOT, file).split(sep).join('/'))
    .sort();
}

it('no screen uses a Cancel string', () => expect(filesMatching(/common\.cancel|['"]Cancel['"]/)).toEqual([]));
it('Back is never a titled button', () => expect(filesMatching(/title=\{en\.common\.back\}/)).toEqual([]));
