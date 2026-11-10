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

  it('reads 24 authenticated operations from the contract', () => {
    expect(operations).toHaveLength(24);
  });

  it('calls every one of them through the API client', () => {
    // getPassportQr is the exception: expo-image loads the picture from its URL, with auth headers.
    const missing = operations
      .filter((op) => op.id !== 'getPassportQr')
      .filter((op) => !new RegExp(`api\\.${op.method}\\(\\s*'${op.path.replace(/[{}]/g, '\\$&')}'`).test(code))
      .map((op) => `${op.id}: ${op.method} ${op.path}`);
    expect(missing).toEqual([]);
  });

  it('loads the QR image from the /qr URL', () => {
    expect(operations.some((op) => op.id === 'getPassportQr')).toBe(true);
    const hook = readFileSync(join(root, 'src/features/passport/api/usePassportFiles.ts'), 'utf8');
    expect(hook).toContain('/qr');
  });
});
