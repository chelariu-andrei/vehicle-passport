/* Writes src/shared/generated/licenses.json: every production package in package-lock.json (the closure, not only the direct
   dependencies), with its licence text. `--check` writes nothing and fails when the committed file is stale.
   Deterministic: sorted, no dates, no absolute paths. Optional packages are left out (they are per-platform native binaries, so
   what is installed differs between machines) as are dev-only ones. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'src', 'shared', 'generated', 'licenses.json');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const MIT = (holder) => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const ISC = (holder) => `ISC License

Copyright (c) ${holder}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.`;

const BSD_CONDITIONS = `Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
`;
const BSD_DISCLAIMER = `THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;

const BSD2 = (holder) => `BSD 2-Clause License

Copyright (c) ${holder}

${BSD_CONDITIONS}
${BSD_DISCLAIMER}`;

const BSD3 = (holder) => `BSD 3-Clause License

Copyright (c) ${holder}

${BSD_CONDITIONS}
3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

${BSD_DISCLAIMER}`;

const ZERO_BSD = (holder) => `BSD Zero Clause License

Copyright (c) ${holder}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.`;

const UNLICENSE = () => `This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or distribute this
software, either in source code form or as a compiled binary, for any purpose,
commercial or non-commercial, and by any means.

In jurisdictions that recognize copyright laws, the author or authors of this
software dedicate any and all copyright interest in the software to the public
domain. We make this dedication for the benefit of the public at large and to
the detriment of our heirs and successors. We intend this dedication to be an
overt act of relinquishment in perpetuity of all present and future rights to
this software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <https://unlicense.org>`;

const TEMPLATES = { MIT, ISC, 'BSD-2-Clause': BSD2, 'BSD-3-Clause': BSD3, '0BSD': ZERO_BSD, Unlicense: UNLICENSE };

function licenseId(pkg, fromLock) {
  const { license, licenses } = pkg;
  if (typeof license === 'string') return license;
  if (license && typeof license.type === 'string') return license.type;
  if (Array.isArray(licenses)) return licenses.map((l) => l.type).filter(Boolean).join(' OR ') || 'UNKNOWN';
  return fromLock ?? 'UNKNOWN';
}

function repositoryUrl(pkg) {
  const raw = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  if (!raw) return null;
  let url = raw.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '');
  const short = /^(?:github:)?([\w.-]+\/[\w.-]+)$/.exec(url);
  if (short) url = `https://github.com/${short[1]}`;
  url = url.replace(/^ssh:\/\/git@/, 'https://').replace(/^git@github\.com:/, 'https://github.com/');
  return /^https?:\/\//.test(url) ? url.replace(/^http:/, 'https:') : null;
}

const META = 'Meta Platforms, Inc. and affiliates';
const META_OWNERS = new Set(['react', 'facebook', 'facebookincubator']);
const META_NAMES = /^(@react-native\/|metro|ob1$|hermes-|react-devtools-|babel-plugin-react-compiler$)/;

/**
 * The copyright holder for a generated notice. Meta's packages are known by name or repository owner; otherwise the package's
 * own `author`. With neither, no holder is invented: the notice points at the source repository and is flagged as inferred.
 */
function holderOf(pkg, repository) {
  const owner = repository ? /^https:\/\/[^/]+\/([^/]+)\//.exec(repository)?.[1]?.toLowerCase() : undefined;
  if (META_NAMES.test(pkg.name) || (owner && META_OWNERS.has(owner))) return { holder: META, inferred: false };
  const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name;
  const name = author?.replace(/<[^>]*>|\([^)]*\)/g, '').trim().replace(/^["']+|["']+$/g, '').trim();
  if (name) return { holder: name, inferred: false };
  return { holder: `the ${pkg.name} authors (see the source repository)`, inferred: true };
}

function licenseFile(dir) {
  const file = readdirSync(dir)
    .filter((name) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(name))
    .sort(byText)[0];
  return file ? readFileSync(join(dir, file), 'utf8').replace(/\r\n?/g, '\n').trim() : null;
}

/** A template for the first alternative of an SPDX expression that has one, or null. */
function templateFor(id) {
  for (const alternative of id.replace(/[()]/g, '').split(/\s+OR\s+/)) {
    if (TEMPLATES[alternative.trim()]) return { id: alternative.trim(), make: TEMPLATES[alternative.trim()] };
  }
  return null;
}

function productionPackages() {
  const found = new Map();
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === '' || entry.link || entry.dev || entry.devOptional || entry.optional) continue;
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    // The lock path is slash-separated on every platform; join splits it for the local file system.
    found.set(`${name}@${entry.version}`, { name, dir: join(root, ...path.split('/')), lock: entry });
  }
  return [...found.values()].sort((a, b) => byText(a.name, b.name) || byText(a.lock.version, b.lock.version));
}

function build() {
  const texts = {};
  const keep = (text) => {
    const id = createHash('sha1').update(text).digest('hex').slice(0, 10);
    texts[id] = text;
    return id;
  };
  const packages = productionPackages().map(({ name, dir, lock: entry }) => {
    if (!existsSync(join(dir, 'package.json'))) throw new Error(`${name} is not installed; run npm ci first`);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const license = licenseId(pkg, entry.license);
    const repository = repositoryUrl(pkg);
    const result = { name, version: entry.version, license, repository, textId: null };
    const text = licenseFile(dir);
    if (text) {
      result.textId = keep(text);
      return result;
    }
    // No licence file shipped: the declared licence's standard text, naming the package's own copyright holder.
    const template = templateFor(license);
    if (template) {
      const { holder, inferred } = holderOf({ ...pkg, name }, repository);
      result.textId = keep(template.make(holder));
      result.generatedFrom = template.id;
      if (inferred) result.holderInferred = true;
    }
    return result;
  });
  const sortedTexts = Object.fromEntries(Object.entries(texts).sort(([a], [b]) => byText(a, b)));
  return `${JSON.stringify({ packages, texts: sortedTexts })}\n`;
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
