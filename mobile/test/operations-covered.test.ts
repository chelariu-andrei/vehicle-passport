/* Every authenticated operation in the contract is called by some feature. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const root = join(__dirname, '..');
const METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) ? [readFileSync(path, 'utf8')] : [];
  });
}

type Operation = { method: string; path: string; id: string };

/**
 * Account operations the server ships before the mobile Account screens (docs/superpowers/plans/2026-11-15-account-mobile.md).
 * Remove an id here as soon as a feature calls it; the last test fails if a listed operation is already in use.
 */
const NOT_YET_CONSUMED = new Set([
  'getSettings',
  'updateSettings',
  'getConsentStatus',
  'listConsentHistory',
  'scheduleDeletion',
  'cancelDeletion',
  'exportMyData',
  'createSupportReport',
]);

function authenticatedOperations(): Operation[] {
  const contract = parse(readFileSync(join(root, '../contracts/openapi.yaml'), 'utf8')) as {
    paths: Record<string, Record<string, { operationId?: string; security?: unknown[] }>>;
  };
  const found: Operation[] = [];
  for (const [path, item] of Object.entries(contract.paths)) {
    for (const method of METHODS) {
      const op = item[method];
      if (!op?.operationId) continue;
      // `security: []` marks the public operations.
      if (Array.isArray(op.security) && op.security.length === 0) continue;
      found.push({ method: method.toUpperCase(), path, id: op.operationId });
    }
  }
  return found;
}

describe('operations covered', () => {
  const operations = authenticatedOperations();
  const code = sources(join(root, 'src/features')).join('\n');

  it('reads 39 authenticated operations from the contract', () => {
    expect(operations).toHaveLength(39);
  });

  const isCalled = (op: Operation) =>
    new RegExp(`api\\.${op.method}\\(\\s*'${op.path.replace(/[{}]/g, '\\$&')}'`).test(code);

  it('calls every one of them through the API client', () => {
    // getPassportQr is the exception: expo-image loads the picture from its URL, with auth headers.
    const missing = operations
      .filter((op) => op.id !== 'getPassportQr' && !NOT_YET_CONSUMED.has(op.id))
      .filter((op) => !isCalled(op))
      .map((op) => `${op.id}: ${op.method} ${op.path}`);
    expect(missing).toEqual([]);
  });

  it('keeps the not-yet-consumed list honest', () => {
    const used = operations.filter((op) => NOT_YET_CONSUMED.has(op.id) && isCalled(op)).map((op) => op.id);
    expect(used).toEqual([]);
    expect(operations.filter((op) => NOT_YET_CONSUMED.has(op.id))).toHaveLength(NOT_YET_CONSUMED.size);
  });

  it('loads the QR image from the /qr URL', () => {
    expect(operations.some((op) => op.id === 'getPassportQr')).toBe(true);
    const hook = readFileSync(join(root, 'src/features/passport/api/usePassportFiles.ts'), 'utf8');
    expect(hook).toContain('/qr');
  });
});
