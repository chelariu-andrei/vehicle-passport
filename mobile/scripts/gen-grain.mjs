// Writes assets/grain.png: 128 x 128 white pixels whose alpha is seeded noise (the Ground's grain layer).
// Usage: node scripts/gen-grain.mjs
import { Buffer } from 'node:buffer';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const SIZE = 128;

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const random = mulberry32(7);
const stride = 1 + SIZE * 4;
const raw = Buffer.alloc(stride * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * stride] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    const i = y * stride + 1 + x * 4;
    raw[i] = raw[i + 1] = raw[i + 2] = 255;
    raw[i + 3] = Math.floor(random() * 256);
  }
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header[8] = 8; // bit depth
header[9] = 6; // RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'grain.png'), png);
