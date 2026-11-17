/* Type-based branching lives in the registry (features/event/model/eventTypes.ts), never in a component. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', 'src', 'features');
const DIRS = [join(ROOT, 'event', 'components'), join(ROOT, 'vehicle')];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

test('no component branches on an event type', () => {
  const offenders: string[] = [];
  for (const file of DIRS.flatMap(sources)) {
    const text = readFileSync(file, 'utf8');
    if (/\.type\s*===/.test(text) || /switch\s*\([^)]*\.type\)/.test(text)) offenders.push(file);
  }
  expect(offenders).toEqual([]);
});
