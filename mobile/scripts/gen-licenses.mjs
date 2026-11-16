/* Writes src/shared/generated/licenses.json from the installed production dependencies of package.json.
   `--check` writes nothing and fails when the committed file is stale. The output is deterministic: sorted, no dates, no absolute paths. */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'src', 'shared', 'generated', 'licenses.json');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function licenseId(pkg) {
  const { license, licenses } = pkg;
  if (typeof license === 'string') return license;
  if (license && typeof license.type === 'string') return license.type;
  if (Array.isArray(licenses)) return licenses.map((l) => l.type).filter(Boolean).join(' OR ') || 'UNKNOWN';
  return 'UNKNOWN';
}

function repositoryUrl(pkg) {
  const raw = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  if (!raw) return null;
  let url = raw.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '');
  const short = /^(?:github:)?([\w.-]+\/[\w.-]+)$/.exec(url);
  if (short) url = `https://github.com/${short[1]}`;
  url = url.replace(/^ssh:\/\/git@/, 'https://').replace(/^git@github\.com:/, 'https://github.com/');
  return /^https?:\/\//.test(url) ? url : null;
}

function licenseText(dir) {
  const file = readdirSync(dir)
    .filter((name) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(name))
    .sort(byName)[0];
  if (!file) return null;
  return readFileSync(join(dir, file), 'utf8').replace(/\r\n?/g, '\n').trim();
}

function build() {
  const texts = {};
  const packages = Object.keys(manifest.dependencies ?? {})
    .sort(byName)
    .map((name) => {
      const dir = join(root, 'node_modules', ...name.split('/'));
      if (!existsSync(join(dir, 'package.json'))) throw new Error(`${name} is not installed; run npm install first`);
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      const text = licenseText(dir);
      let textId = null;
      if (text) {
        // One copy per distinct text; packages point at it.
        textId = createHash('sha1').update(text).digest('hex').slice(0, 10);
        texts[textId] = text;
      }
      return { name, version: pkg.version, license: licenseId(pkg), repository: repositoryUrl(pkg), textId };
    });
  const sortedTexts = Object.fromEntries(Object.entries(texts).sort(([a], [b]) => byName(a, b)));
  return `${JSON.stringify({ packages, texts: sortedTexts }, null, 2)}\n`;
}

const output = build();
if (process.argv.includes('--check')) {
  const current = existsSync(target) ? readFileSync(target, 'utf8').replace(/\r\n/g, '\n') : '';
  if (current !== output) {
    console.error('licenses.json is stale. Run: npm run gen:licenses');
    process.exit(1);
  }
  console.log('licenses.json is up to date');
} else {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, output);
  console.log('wrote src/shared/generated/licenses.json');
}
