/* Vehicle Passport car kit.
 * Seven stylised, unbranded body types built in code: no model files, no licence, no decoder.
 * The same file runs in the design-system previews and in the app's WebView viewer.
 *
 *   import { createCarKit, carSilhouette, BODY_TYPES, PALETTE } from './car-kit.js';
 *   const kit = createCarKit(THREE);
 *   const car = kit.createCar({ bodyType: 'SEDAN', color: 'GREEN' });
 *   scene.add(car.group); car.apply({ finish: 'MATTE' });
 *
 * Units are metres. The car sits on y = 0, is centred on x and z, and faces +x.
 */

export const BODY_TYPES = ['HATCHBACK', 'SEDAN', 'ESTATE', 'SUV', 'COUPE', 'MPV', 'PICKUP'];

export const BODY_LABELS = {
  HATCHBACK: 'Hatchback', SEDAN: 'Sedan', ESTATE: 'Estate', SUV: 'SUV',
  COUPE: 'Coupé / Cabrio', MPV: 'MPV / Van', PICKUP: 'Pickup',
};

/* The named palette the server stores (a code, never a hex). The shade is a client choice. */
export const PALETTE = [
  { code: 'WHITE', name: 'White', hex: '#e9ecea' },
  { code: 'BLACK', name: 'Black', hex: '#0b0d0c' },
  { code: 'SILVER', name: 'Silver', hex: '#b4bbb8' },
  { code: 'GREY', name: 'Grey', hex: '#565d5a' },
  { code: 'BLUE', name: 'Blue', hex: '#1d4a86' },
  { code: 'RED', name: 'Red', hex: '#a3171d' },
  { code: 'GREEN', name: 'Green', hex: '#1c6b49' },
  { code: 'BEIGE', name: 'Beige', hex: '#cbbd9d' },
  { code: 'BROWN', name: 'Brown', hex: '#5a3a26' },
  { code: 'YELLOW', name: 'Yellow', hex: '#dcb013' },
  { code: 'ORANGE', name: 'Orange', hex: '#d2601a' },
  { code: 'GOLD', name: 'Gold', hex: '#ad8a3b' },
];

export const FINISHES = ['GLOSS', 'METALLIC', 'SATIN', 'MATTE'];
export const WHEEL_STYLES = ['FIVE_SPOKE', 'MULTI_SPOKE', 'AERO'];
export const RIM_COLORS = ['SILVER', 'BLACK', 'BODY'];
export const GLASS_TINTS = ['LIGHT', 'DARK'];

export const NEUTRAL_LOOK = {
  bodyType: null, color: 'GREY', colorHex: null, finish: 'GLOSS',
  wheels: 'FIVE_SPOKE', rimColor: 'SILVER', glassTint: 'LIGHT', contrastRoof: false, plate: '',
};

/* Every measure below is in metres. `s` runs from the front bumper (0) to the rear bumper (L).
 * top: the roofline seen from the side. ws / rg / side: where windscreen, rear glass and side glass sit.
 */
const SPECS = {
  HATCHBACK: {
    L: 4.1, W: 1.78, r: 0.32, clr: 0.16, axles: [0.84, 3.42], belt: [0.94, 1.0],
    top: [[0, 0.6], [0.12, 0.72], [0.85, 0.89], [1.22, 0.96], [2.05, 1.45], [3.3, 1.44], [3.86, 1.04], [4.02, 0.98], [4.1, 0.8]],
    ws: [1.28, 2.02], rg: [3.36, 3.84], side: [1.42, 3.3], pillars: [2.42],
  },
  SEDAN: {
    L: 4.7, W: 1.82, r: 0.335, clr: 0.17, axles: [0.92, 3.72], belt: [0.93, 0.99],
    top: [[0, 0.6], [0.12, 0.72], [1.0, 0.9], [1.45, 0.96], [2.35, 1.42], [3.2, 1.43], [4.02, 1.06], [4.58, 1.03], [4.7, 0.86]],
    ws: [1.5, 2.3], rg: [3.26, 3.98], side: [1.64, 3.7], pillars: [2.72],
  },
  ESTATE: {
    L: 4.75, W: 1.82, r: 0.335, clr: 0.17, axles: [0.92, 3.72], belt: [0.93, 0.99],
    top: [[0, 0.6], [0.12, 0.72], [1.0, 0.9], [1.45, 0.96], [2.3, 1.45], [4.08, 1.42], [4.52, 1.06], [4.66, 1.0], [4.75, 0.82]],
    ws: [1.5, 2.26], rg: [4.14, 4.5], side: [1.64, 4.04], pillars: [2.7, 3.52],
  },
  SUV: {
    L: 4.6, W: 1.9, r: 0.385, clr: 0.23, axles: [0.9, 3.62], belt: [1.12, 1.17], cladding: 4,
    top: [[0, 0.8], [0.1, 0.95], [0.95, 1.08], [1.3, 1.14], [2.05, 1.67], [3.88, 1.65], [4.36, 1.24], [4.52, 1.16], [4.6, 0.98]],
    ws: [1.34, 2.0], rg: [3.94, 4.32], side: [1.5, 3.84], pillars: [2.55, 3.36],
  },
  COUPE: {
    L: 4.5, W: 1.86, r: 0.345, clr: 0.13, axles: [0.95, 3.6], belt: [0.84, 0.9],
    top: [[0, 0.52], [0.12, 0.62], [1.2, 0.8], [1.75, 0.86], [2.6, 1.26], [3.0, 1.27], [4.08, 0.95], [4.4, 0.93], [4.5, 0.78]],
    ws: [1.8, 2.56], rg: [3.08, 3.98], side: [1.94, 3.3], pillars: [],
  },
  MPV: {
    L: 4.7, W: 1.88, r: 0.34, clr: 0.17, axles: [0.88, 3.83], belt: [1.04, 1.07],
    top: [[0, 0.72], [0.1, 0.9], [0.55, 1.0], [0.85, 1.06], [1.75, 1.73], [4.3, 1.74], [4.6, 1.22], [4.7, 0.9]],
    ws: [0.9, 1.7], rg: [4.34, 4.58], side: [1.06, 4.24], pillars: [1.96, 3.1],
  },
  PICKUP: {
    L: 5.3, W: 1.92, r: 0.4, clr: 0.25, axles: [0.95, 4.2], belt: [1.16, 1.18], cladding: 4,
    top: [[0, 0.86], [0.1, 1.0], [1.0, 1.12], [1.4, 1.18], [2.1, 1.73], [3.04, 1.73], [3.3, 1.27], [5.2, 1.26], [5.3, 1.1]],
    ws: [1.44, 2.05], rg: [3.08, 3.28], side: [1.6, 2.98], pillars: [2.3], bed: [3.44, 5.14],
  },
};

const END = 0.32; // length of the rounded nose and tail
const N_BOTTOM = 5;
const N_SIDE = 20;
const N_CABIN = 10;
const N_ROOF = 10;
const RING = N_BOTTOM + N_SIDE + N_CABIN + N_ROOF;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/* Monotone cubic through the roofline points: smooth, and it never overshoots a point. */
function curve(points) {
  const n = points.length;
  const x = points.map((p) => p[0]);
  const y = points.map((p) => p[1]);
  const h = [];
  const d = [];
  for (let i = 0; i < n - 1; i += 1) {
    h[i] = x[i + 1] - x[i];
    d[i] = (y[i + 1] - y[i]) / h[i];
  }
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return (s) => {
    let i = 0;
    while (i < n - 2 && s > x[i + 1]) i += 1;
    const t = clamp01((s - x[i]) / h[i]);
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}

function profile(spec) {
  const top = curve(spec.top);
  const end = (s) => Math.min(s, spec.L - s);
  return {
    top,
    bottom: (s) => spec.clr + 0.13 * Math.pow(1 - Math.min(end(s) / 0.55, 1), 2),
    belt: (s) => Math.min(lerp(spec.belt[0], spec.belt[1], s / spec.L), top(s) - 0.06),
    halfWidth: (s) => {
      const u = (s / spec.L) * 2 - 1;
      let w = (spec.W / 2) * (1 - 0.06 * Math.pow(Math.abs(u), 3));
      const e = end(s);
      if (e < END) w *= Math.pow(1 - Math.pow(1 - e / END, 2.7), 1 / 2.7);
      return w;
    },
  };
}

function stationsFor(L) {
  const out = [];
  const nEnd = 14;
  for (let k = 0; k < nEnd; k += 1) out.push(END * (1 - Math.cos(((k / nEnd) * Math.PI) / 2)));
  const nMid = Math.round((L - 2 * END) / 0.03);
  for (let k = 0; k <= nMid; k += 1) out.push(END + ((L - 2 * END) * k) / nMid);
  for (let k = nEnd - 1; k >= 0; k -= 1) out.push(L - END * (1 - Math.cos(((k / nEnd) * Math.PI) / 2)));
  return out;
}

/* Which part of the cross-section a ring point belongs to. */
function segment(j) {
  if (j < N_BOTTOM) return { type: 'B', k: j, n: N_BOTTOM - 1 };
  if (j < N_BOTTOM + N_SIDE) return { type: 'S', k: j - N_BOTTOM + 1, n: N_SIDE };
  if (j < N_BOTTOM + N_SIDE + N_CABIN) return { type: 'C', k: j - N_BOTTOM - N_SIDE + 1, n: N_CABIN };
  return { type: 'R', k: j - N_BOTTOM - N_SIDE - N_CABIN + 1, n: N_ROOF };
}

/* One half cross-section (z >= 0), from the centre of the floor to the centre of the roof. */
function halfRing(spec, shape, s) {
  const w = shape.halfWidth(s);
  const y0 = shape.bottom(s);
  const y1 = shape.top(s);
  const yb = shape.belt(s);
  const cabin = smoothstep(0, 0.28, y1 - yb - 0.06);
  const tumble = lerp(0.93, 0.8, cabin);
  const crown = lerp(0.03, 0.07, cabin);
  const points = [];
  for (let k = 0; k < N_BOTTOM; k += 1) points.push({ z: (0.84 * w * k) / (N_BOTTOM - 1), y: y0 });
  for (let k = 1; k <= N_SIDE; k += 1) {
    const t = k / N_SIDE;
    points.push({ z: w * (1 - 0.16 * Math.pow(1 - t, 4) - 0.035 * Math.pow(t, 3)), y: lerp(y0, yb, t) });
  }
  const zBelt = w * (1 - 0.035);
  for (let k = 1; k <= N_CABIN; k += 1) {
    const t = k / N_CABIN;
    points.push({ z: lerp(zBelt, w * tumble, 0.85 * t + 0.15 * t * t), y: lerp(yb, y1 - crown, t) });
  }
  for (let k = 1; k <= N_ROOF; k += 1) {
    const t = k / N_ROOF;
    points.push({ z: w * tumble * (1 - t), y: y1 - crown * Math.pow(1 - t, 2.2) });
  }
  // Two light passes round the shoulder and the roof edge without moving the floor.
  for (let pass = 0; pass < 2; pass += 1) {
    const copy = points.map((p) => ({ z: p.z, y: p.y }));
    for (let j = N_BOTTOM + 2; j < RING - 1; j += 1) {
      points[j].z = (copy[j - 1].z + 2 * copy[j].z + copy[j + 1].z) / 4;
      points[j].y = (copy[j - 1].y + 2 * copy[j].y + copy[j + 1].y) / 4;
    }
  }
  return { points, w, cabinHeight: y1 - crown - yb };
}

const MAT = { PAINT: 0, GLASS: 1, TRIM: 2, ROOF: 3, ARCH: 4 };

/* The body as plain arrays: positions, and one index list per material. */
function bodyMesh(spec) {
  const shape = profile(spec);
  const S = stationsFor(spec.L);
  const NS = S.length;
  const rings = S.map((s) => halfRing(spec, shape, s));
  const P = rings.map((ring, i) => ring.points.map((p) => ({ x: spec.L / 2 - S[i], y: p.y, z: p.z, inside: false, edge: false, bed: false })));

  // Wheel wells: points inside the arch sink into the body, points near it land exactly on the circle.
  const archRadius = spec.r + 0.065;
  const depth = 0.27;
  const band = 0.5 * Math.hypot(0.03, (spec.belt[0] - spec.clr) / N_SIDE) + 0.005;
  spec.axles.forEach((axle) => {
    const xw = spec.L / 2 - axle;
    for (let i = 0; i < NS; i += 1) {
      if (Math.abs(P[i][0].x - xw) > archRadius + 0.1) continue;
      for (let j = N_BOTTOM - 1; j < N_BOTTOM + N_SIDE; j += 1) {
        const p = P[i][j];
        const dx = p.x - xw;
        const dy = p.y - spec.r;
        const d = Math.hypot(dx, dy);
        if (d < archRadius - band) {
          p.z = Math.min(p.z, rings[i].w - depth);
          p.inside = true;
        } else if (d < archRadius + band && d > 0) {
          p.x = xw + (dx / d) * archRadius;
          p.y = spec.r + (dy / d) * archRadius;
          p.edge = true;
        }
      }
    }
  });

  // Pickup bed: the inner part of the deck drops to make an open box.
  if (spec.bed) {
    for (let i = 0; i < NS; i += 1) {
      if (S[i] < spec.bed[0] || S[i] > spec.bed[1]) continue;
      for (let j = RING - N_ROOF + 1; j < RING; j += 1) {
        P[i][j].y -= 0.42;
        P[i][j].bed = true;
      }
    }
  }

  const rowWidth = RING + RING - 2;
  const right = (i, j) => i * rowWidth + j;
  const left = (i, j) => (j === 0 || j === RING - 1 ? right(i, j) : i * rowWidth + RING + j - 1);
  const positions = new Float32Array(NS * rowWidth * 3);
  for (let i = 0; i < NS; i += 1) {
    for (let j = 0; j < RING; j += 1) {
      const p = P[i][j];
      positions.set([p.x, p.y, p.z], right(i, j) * 3);
      if (j > 0 && j < RING - 1) positions.set([p.x, p.y, -p.z], left(i, j) * 3);
    }
  }

  const within = (s, range) => s > range[0] && s < range[1];
  const inPillar = (s) => spec.pillars.some((x) => Math.abs(s - x) < 0.045);

  function materialOf(i, j) {
    const corners = [P[i][j], P[i + 1][j], P[i][j + 1], P[i + 1][j + 1]];
    const g = segment(j + 1);
    const s = (S[i] + S[i + 1]) / 2;
    if (g.type === 'B') return MAT.TRIM;
    if (g.type === 'S') {
      const t = g.k / g.n;
      if (i < 3 && t > 0.1 && t <= 0.5) return MAT.TRIM;
      if (i >= NS - 4 && t <= 0.25) return MAT.TRIM;
      if (spec.cladding && g.k <= spec.cladding) return MAT.TRIM;
      return MAT.PAINT;
    }
    const tall = rings[i].cabinHeight > 0.16 && rings[i + 1].cabinHeight > 0.16;
    if (g.type === 'C') {
      return tall && g.k < g.n && within(s, spec.side) && !inPillar(s) ? MAT.GLASS : MAT.PAINT;
    }
    if (corners.some((p) => p.bed)) return MAT.TRIM;
    if (g.k >= 2 && (within(s, spec.ws) || within(s, spec.rg))) return MAT.GLASS;
    if (s >= spec.ws[1] && s <= spec.rg[0]) return MAT.ROOF;
    return MAT.PAINT;
  }

  const lists = Object.keys(MAT).map(() => []);
  // The well gets its own copy of the points on the arch edge. Sharing them would blend the wall's
  // normals into the paint and leave a dark, blocky halo round every wheel.
  const twins = new Map();
  const extra = [];
  const twin = (v) => {
    let t = twins.get(v);
    if (t === undefined) {
      t = positions.length / 3 + extra.length / 3;
      twins.set(v, t);
      extra.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    }
    return t;
  };
  const emit = (flags, list, indices) => {
    if (Math.max(flags[0], flags[1], flags[2]) === 1) lists[MAT.ARCH].push(...indices.map(twin));
    else list.push(...indices);
  };
  for (let i = 0; i < NS - 1; i += 1) {
    for (let j = 0; j < RING - 1; j += 1) {
      const base = lists[materialOf(i, j)];
      // A triangle belongs to the wheel well when it reaches inside the arch. The quad is split along
      // whichever diagonal keeps well and body in separate triangles, so the arch edge is a clean circle.
      const side = (p) => (p.inside ? 1 : p.edge ? 0 : -1);
      const fa = side(P[i][j]);
      const fb = side(P[i + 1][j]);
      const fc = side(P[i + 1][j + 1]);
      const fd = side(P[i][j + 1]);
      const mixed = (x, y, z) => Math.max(x, y, z) === 1 && Math.min(x, y, z) === -1;
      const a = right(i, j);
      const b = right(i + 1, j);
      const c = right(i + 1, j + 1);
      const d = right(i, j + 1);
      const la = left(i, j);
      const lb = left(i + 1, j);
      const lc = left(i + 1, j + 1);
      const ld = left(i, j + 1);
      if (mixed(fa, fd, fc) || mixed(fa, fc, fb)) {
        emit([fa, fd, fb], base, [a, d, b, la, lb, ld]);
        emit([fd, fc, fb], base, [d, c, b, lb, lc, ld]);
      } else {
        emit([fa, fd, fc], base, [a, d, c, la, lc, ld]);
        emit([fa, fc, fb], base, [a, c, b, la, lb, lc]);
      }
    }
  }
  const all = new Float32Array(positions.length + extra.length);
  all.set(positions);
  all.set(extra, positions.length);
  return { positions: all, lists, shape };
}

/* The side view as SVG path data, drawn from the same roofline as the 3D body. Viewbox: 0 0 100 40. */
export function carSilhouette(bodyType) {
  const spec = SPECS[bodyType] || SPECS.SEDAN;
  const shape = profile(spec);
  const k = 96 / 5.3;
  const ox = 2 + ((5.3 - spec.L) * k) / 2;
  const X = (s) => (ox + s * k).toFixed(2);
  const Y = (y) => (38 - y * k).toFixed(2);
  const steps = 72;
  const arch = (spec.r + 0.065) * k;
  let body = `M${X(0)} ${Y(shape.bottom(0))}`;
  for (let i = 0; i <= steps; i += 1) {
    const s = (spec.L * i) / steps;
    body += `L${X(s)} ${Y(shape.top(s))}`;
  }
  body += `L${X(spec.L)} ${Y(shape.bottom(spec.L))}`;
  const floor = Y(spec.clr);
  [spec.axles[1], spec.axles[0]].forEach((axle) => {
    const half = Math.sqrt(Math.max(0, Math.pow(spec.r + 0.065, 2) - Math.pow(spec.clr - spec.r, 2)));
    body += `L${X(axle + half)} ${floor}A${arch.toFixed(2)} ${arch.toFixed(2)} 0 0 0 ${X(axle - half)} ${floor}`;
  });
  body += 'Z';
  let glass = '';
  const upper = [];
  const lower = [];
  for (let i = 0; i <= 40; i += 1) {
    const s = lerp(spec.side[0], spec.side[1], i / 40);
    const hi = shape.top(s) - 0.1;
    const lo = shape.belt(s) + 0.02;
    if (hi - lo > 0.05) {
      upper.push(`${X(s)} ${Y(hi)}`);
      lower.unshift(`${X(s)} ${Y(lo)}`);
    }
  }
  if (upper.length) glass = `M${upper.join('L')}L${lower.join('L')}Z`;
  const wheels = spec.axles.map((axle) => ({ cx: Number(X(axle)), cy: Number(Y(spec.r)), r: Number((spec.r * k).toFixed(2)) }));
  return { viewBox: '0 0 100 40', body, glass, wheels };
}

/** The body as plain arrays, with its length and width in metres. No three.js needed: this is what the geometry tests read. */
export function bodyGeometry(bodyType) {
  const spec = SPECS[bodyType] || SPECS.SEDAN;
  const { positions, lists } = bodyMesh(spec);
  return { positions, lists, length: spec.L, width: spec.W };
}

/** The closest named colour to any hex, so a custom shade still files under a palette code. */
export function nearestPaletteCode(hex) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex);
  let best = PALETTE[0];
  let bestDistance = Infinity;
  PALETTE.forEach((entry) => {
    const [pr, pg, pb] = rgb(entry.hex);
    const distance = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2;
    if (distance < bestDistance) {
      best = entry;
      bestDistance = distance;
    }
  });
  return best.code;
}

export function resolveHex(look) {
  if (look.colorHex && /^#[0-9a-f]{6}$/i.test(look.colorHex)) return look.colorHex;
  const entry = PALETTE.find((p) => p.code === look.color);
  return (entry || PALETTE[3]).hex;
}

const FINISH = {
  GLOSS: { metalness: 0.15, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.03 },
  METALLIC: { metalness: 0.85, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.05 },
  SATIN: { metalness: 0.5, roughness: 0.52, clearcoat: 0.35, clearcoatRoughness: 0.45 },
  MATTE: { metalness: 0.15, roughness: 0.86, clearcoat: 0, clearcoatRoughness: 1 },
};

export function createCarKit(THREE) {
  function drawPlate(canvas, text) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const round = (x, y, rw, rh, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + rw, y, x + rw, y + rh, r);
      ctx.arcTo(x + rw, y + rh, x, y + rh, r);
      ctx.arcTo(x, y + rh, x, y, r);
      ctx.arcTo(x, y, x + rw, y, r);
      ctx.closePath();
    };
    round(0, 0, w, h, 14);
    ctx.fillStyle = '#0b0d0c';
    ctx.fill();
    round(5, 5, w - 10, h - 10, 10);
    ctx.fillStyle = '#f4f5f2';
    ctx.fill();
    ctx.save();
    round(5, 5, w - 10, h - 10, 10);
    ctx.clip();
    ctx.fillStyle = '#1b3f94';
    ctx.fillRect(5, 5, 58, h - 10);
    ctx.restore();
    ctx.fillStyle = '#f2c230';
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(34 + Math.cos(a) * 15, 40 + Math.sin(a) * 15, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 24px Sora, system-ui, sans-serif';
    ctx.fillText('RO', 34, 88);
    ctx.fillStyle = '#0b0d0c';
    let size = 76;
    do {
      ctx.font = `600 ${size}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
      size -= 4;
    } while (ctx.measureText(text).width > w - 96 && size > 30);
    ctx.fillText(text, 63 + (w - 68) / 2, h / 2 + 4);
  }

  function wheelParts(spec, style) {
    const r = spec.r;
    const tyreWidth = 0.225;
    const hw = tyreWidth / 2;
    const rim = r * 0.67;
    const shoulder = 0.04;
    const outline = [[rim, -hw]];
    for (let a = 0; a <= 6; a += 1) {
      const th = (a / 6) * (Math.PI / 2);
      outline.push([r - shoulder + Math.sin(th) * shoulder, -hw + shoulder - Math.cos(th) * shoulder]);
    }
    for (let a = 0; a <= 6; a += 1) {
      const th = (a / 6) * (Math.PI / 2);
      outline.push([r - shoulder + Math.cos(th) * shoulder, hw - shoulder + Math.sin(th) * shoulder]);
    }
    outline.push([rim, hw]);
    const tyre = new THREE.LatheGeometry(outline.map((p) => new THREE.Vector2(p[0], p[1])), 44).rotateX(Math.PI / 2);
    const barrel = new THREE.CylinderGeometry(rim, rim, tyreWidth * 0.86, 44, 1, true).rotateX(Math.PI / 2);
    const disc = new THREE.CylinderGeometry(rim * 0.72, rim * 0.72, 0.02, 40).rotateX(Math.PI / 2).translate(0, 0, hw - 0.1);
    const lip = new THREE.TorusGeometry(rim - 0.008, 0.013, 8, 56).translate(0, 0, hw - 0.012);
    const face = [];
    const flat = { depth: 0.028, bevelEnabled: false };
    if (style === 'AERO') {
      const plate = new THREE.Shape();
      plate.absarc(0, 0, rim * 0.97, 0, Math.PI * 2, false);
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
        const hole = new THREE.Path();
        hole.absellipse(Math.cos(a) * rim * 0.62, Math.sin(a) * rim * 0.62, rim * 0.2, rim * 0.1, 0, Math.PI * 2, true, a + Math.PI / 2);
        plate.holes.push(hole);
      }
      face.push(new THREE.ExtrudeGeometry(plate, { depth: 0.02, bevelEnabled: false, curveSegments: 28 }).translate(0, 0, hw - 0.05));
    } else {
      const count = style === 'MULTI_SPOKE' ? 10 : 5;
      const inner = style === 'MULTI_SPOKE' ? rim * 0.05 : rim * 0.13;
      const outer = style === 'MULTI_SPOKE' ? rim * 0.035 : rim * 0.07;
      for (let i = 0; i < count; i += 1) {
        const spoke = new THREE.Shape();
        spoke.moveTo(rim * 0.1, -inner);
        spoke.lineTo(rim * 0.98, -outer);
        spoke.lineTo(rim * 0.98, outer);
        spoke.lineTo(rim * 0.1, inner);
        spoke.closePath();
        face.push(new THREE.ExtrudeGeometry(spoke, flat).rotateZ((i / count) * Math.PI * 2 + Math.PI / 2).translate(0, 0, hw - 0.06));
      }
      face.push(new THREE.CylinderGeometry(rim * 0.2, rim * 0.25, 0.05, 28).rotateX(Math.PI / 2).translate(0, 0, hw - 0.04));
    }
    return { tyre, barrel, disc, lip, face, tyreWidth };
  }

  /* A light blade that follows the body round the corner at one height: white at the nose, red at the tail. */
  function lightBar(spec, shape, rear) {
    const centre = rear ? shape.top(spec.L) - 0.135 : shape.top(0) - 0.105;
    const half = rear ? 0.021 : 0.016;
    const reach = rear ? 0.4 : 0.46;
    const n = 24;
    const surface = (e, y) => {
      const s = rear ? spec.L - e : e;
      const y0 = shape.bottom(s);
      const t = clamp01((y - y0) / (shape.belt(s) - y0));
      return [spec.L / 2 - s, y, shape.halfWidth(s) * (1 - 0.16 * Math.pow(1 - t, 4) - 0.035 * Math.pow(t, 3))];
    };
    const columns = [];
    for (let k = -n; k <= n; k += 1) {
      const e = reach * (1 - Math.cos((Math.abs(k) / n) * (Math.PI / 2)));
      const thin = half * (1 - Math.pow(e / reach, 3));
      const side = k < 0 ? -1 : 1;
      const low = surface(e, centre - thin);
      const high = surface(e, centre + thin);
      columns.push(low[0], low[1], side * low[2], high[0], high[1], side * high[2]);
    }
    const index = [];
    for (let c = 0; c < 2 * n; c += 1) {
      const a = c * 2;
      index.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(columns, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    return geometry;
  }

  function createCar(initial) {
    const look = { ...NEUTRAL_LOOK, ...initial };
    const group = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({ color: 0x565d5a });
    const roof = new THREE.MeshPhysicalMaterial({ color: 0x565d5a });
    const glass = new THREE.MeshStandardMaterial({ color: 0x232d31, metalness: 0, roughness: 0.22, envMapIntensity: 0.5 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x0d0f0e, roughness: 0.72, metalness: 0.15 });
    const head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf2fff8, emissiveIntensity: 1.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const tail = new THREE.MeshStandardMaterial({ color: 0x3a0505, emissive: 0xd80f0a, emissiveIntensity: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const arch = new THREE.MeshStandardMaterial({ color: 0x030404, roughness: 1 });
    const tyre = new THREE.MeshStandardMaterial({ color: 0x0c0d0d, roughness: 0.88, side: THREE.DoubleSide });
    const rim = new THREE.MeshStandardMaterial({ color: 0xc4cac7, metalness: 1, roughness: 0.32 });
    const barrel = new THREE.MeshStandardMaterial({ color: 0x1a1d1c, metalness: 0.8, roughness: 0.5, side: THREE.DoubleSide });
    const brake = new THREE.MeshStandardMaterial({ color: 0x6b716e, metalness: 1, roughness: 0.45 });
    const plateCanvas = document.createElement('canvas');
    plateCanvas.width = 512;
    plateCanvas.height = 116;
    const plateTexture = new THREE.CanvasTexture(plateCanvas);
    if ('colorSpace' in plateTexture) plateTexture.colorSpace = THREE.SRGBColorSpace;
    plateTexture.anisotropy = 4;
    const plateMaterial = new THREE.MeshStandardMaterial({ map: plateTexture, transparent: true, roughness: 0.5 });

    let built = { bodyType: undefined, wheels: undefined };
    let parts = [];
    let plates = [];

    function clear() {
      parts.forEach((mesh) => {
        group.remove(mesh);
        mesh.geometry.dispose();
      });
      parts = [];
      plates = [];
    }

    function add(geometry, material, shadow) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = shadow !== false;
      group.add(mesh);
      parts.push(mesh);
      return mesh;
    }

    function build() {
      clear();
      const spec = SPECS[look.bodyType] || SPECS.SEDAN;
      const { positions, lists, shape } = bodyMesh(spec);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const index = [];
      lists.forEach((list, material) => {
        geometry.addGroup(index.length, list.length, material);
        for (let i = 0; i < list.length; i += 1) index.push(list[i]);
      });
      geometry.setIndex(index);
      geometry.computeVertexNormals();
      add(geometry, [paint, glass, trim, roof, arch]);
      add(lightBar(spec, shape, false), head, false);
      add(lightBar(spec, shape, true), tail, false);

      const wheel = wheelParts(spec, look.wheels);
      spec.axles.forEach((axle) => {
        [1, -1].forEach((side) => {
          const x = spec.L / 2 - axle;
          const z = side * (shape.halfWidth(axle) - 0.03 - wheel.tyreWidth / 2);
          const place = (geometry, material) => {
            const mesh = add(geometry.clone(), material);
            mesh.position.set(x, spec.r, z);
            if (side < 0) mesh.rotation.y = Math.PI;
          };
          place(wheel.tyre, tyre);
          place(wheel.barrel, barrel);
          place(wheel.disc, brake);
          place(wheel.lip, rim);
          wheel.face.forEach((g) => place(g, rim));
        });
      });
      [wheel.tyre, wheel.barrel, wheel.disc, wheel.lip, ...wheel.face].forEach((g) => g.dispose());

      // Door mirrors, where the windscreen meets the belt line.
      const mirrorAt = spec.ws[0] + 0.2;
      [1, -1].forEach((side) => {
        const mirror = add(new THREE.SphereGeometry(0.075, 18, 12).scale(1.25, 0.72, 0.9), paint);
        mirror.position.set(spec.L / 2 - mirrorAt, shape.belt(mirrorAt) + 0.075, side * (shape.halfWidth(mirrorAt) * 0.965 + 0.07));
      });

      // Number plates sit just proud of the nose and the tail.
      const plateGeometry = new THREE.PlaneGeometry(0.52, 0.118);
      const frontY = lerp(shape.bottom(0), shape.belt(0), 0.32);
      const rearY = lerp(shape.bottom(spec.L), shape.belt(spec.L), 0.46);
      const front = add(plateGeometry, plateMaterial, false);
      front.position.set(spec.L / 2 + 0.006, frontY, 0);
      front.rotation.y = Math.PI / 2;
      const rear = add(plateGeometry.clone(), plateMaterial, false);
      rear.position.set(-spec.L / 2 - 0.006, rearY, 0);
      rear.rotation.y = -Math.PI / 2;
      plates = [front, rear];
      built = { bodyType: look.bodyType, wheels: look.wheels };
    }

    function paintAll() {
      const hex = resolveHex(look);
      const finish = FINISH[look.finish] || FINISH.GLOSS;
      paint.color.set(hex);
      Object.assign(paint, finish);
      if (look.contrastRoof) {
        roof.color.set('#0b0d0c');
        Object.assign(roof, FINISH.GLOSS);
      } else {
        roof.color.set(hex);
        Object.assign(roof, finish);
      }
      glass.color.set(look.glassTint === 'DARK' ? '#0a0e0f' : '#27333a');
      glass.envMapIntensity = look.glassTint === 'DARK' ? 0.3 : 0.5;
      if (look.rimColor === 'BLACK') {
        rim.color.set('#151817');
        rim.roughness = 0.38;
      } else if (look.rimColor === 'BODY') {
        rim.color.set(hex);
        rim.roughness = 0.4;
      } else {
        rim.color.set('#c4cac7');
        rim.roughness = 0.32;
      }
      const text = (look.plate || '').trim();
      plates.forEach((mesh) => {
        mesh.visible = text.length > 0;
      });
      if (text) {
        drawPlate(plateCanvas, text);
        plateTexture.needsUpdate = true;
      }
    }

    function apply(change) {
      Object.assign(look, change);
      if (look.bodyType !== built.bodyType || look.wheels !== built.wheels) build();
      paintAll();
      return look;
    }

    apply({});
    // The plate is drawn with the brand's mono face, which may arrive after the first paint.
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => paintAll()).catch(() => {});
    }

    return {
      group,
      apply,
      get look() {
        return { ...look };
      },
      get length() {
        return (SPECS[look.bodyType] || SPECS.SEDAN).L;
      },
      dispose() {
        clear();
        [paint, roof, glass, trim, head, tail, arch, tyre, rim, barrel, brake, plateMaterial].forEach((m) => m.dispose());
        plateTexture.dispose();
      },
    };
  }

  return { createCar };
}
