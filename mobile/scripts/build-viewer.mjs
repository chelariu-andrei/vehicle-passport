// Bundles viewer/main.js and viewer/index.template.html into assets/viewer/viewer.html.
// three.js and the code-built car are inlined, so the page needs no network.
// Usage: node scripts/build-viewer.mjs
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const result = await build({
  entryPoints: [join(root, 'viewer', 'main.js')],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  target: 'es2019',
  legalComments: 'none',
});

// "</script" inside the bundle would end the inline script early.
const bundle = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const template = readFileSync(join(root, 'viewer', 'index.template.html'), 'utf8');
const html = template.replace('/*__BUNDLE__*/', () => bundle);

writeFileSync(join(root, 'assets', 'viewer', 'viewer.html'), html);
console.log(`assets/viewer/viewer.html: ${(html.length / 1024).toFixed(0)} KiB`);
