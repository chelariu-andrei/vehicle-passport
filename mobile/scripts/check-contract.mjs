import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const committed = 'src/shared/api/generated/schema.d.ts';
const dir = mkdtempSync(join(tmpdir(), 'contract-'));
const fresh = join(dir, 'schema.d.ts');

try {
  execSync(`npx --yes openapi-typescript@7.13.0 ../contracts/openapi.yaml -o "${fresh}"`, {
    stdio: 'ignore',
  });
  const strip = (path) => readFileSync(path, 'utf8').replaceAll('\r', '');
  if (strip(fresh) !== strip(committed)) {
    console.error('Generated API types are stale. Run npm run gen:api.');
    process.exitCode = 1;
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
