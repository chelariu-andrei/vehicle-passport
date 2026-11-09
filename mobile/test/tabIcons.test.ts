import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* A checked shield reads as "verified"; only VERIFIED evidence may say that (design section 2). */
test('the tab bar uses no shield or verified icon', () => {
  const layout = readFileSync(join(__dirname, '../app/(tabs)/_layout.tsx'), 'utf8');
  expect(layout).not.toMatch(/shield/i);
  expect(layout).not.toMatch(/verified_user/);
});
