import { BODY_TYPES, bodyGeometry, carSilhouette } from '../../viewer/car-kit';

describe.each(BODY_TYPES)('%s', (type) => {
  it('is a closed, mirrored, finite body', () => {
    const g = bodyGeometry(type);
    const p = Array.from(g.positions);
    expect(p.length % 3).toBe(0);
    expect(p.every(Number.isFinite)).toBe(true);
    const count = p.length / 3;
    g.lists.forEach((list: ArrayLike<number>) => {
      expect(list.length % 3).toBe(0);
      expect(Array.from(list).every((i) => Number.isInteger(i) && i >= 0 && i < count)).toBe(true);
    });
    const xs: number[] = [];
    const key = (x: number, y: number, z: number) => `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    const points = new Set<string>();
    let minY = Infinity;
    let maxZ = 0;
    for (let i = 0; i < p.length; i += 3) {
      xs.push(p[i]);
      minY = Math.min(minY, p[i + 1]);
      maxZ = Math.max(maxZ, Math.abs(p[i + 2]));
      points.add(key(p[i], p[i + 1], p[i + 2]));
    }
    expect(Math.abs(Math.max(...xs) - Math.min(...xs) - g.length)).toBeLessThanOrEqual(0.02);
    expect(maxZ).toBeLessThanOrEqual(g.width / 2 + 1e-6);
    expect(minY).toBeGreaterThanOrEqual(0.1);
    for (let i = 0; i < p.length; i += 3) {
      if (p[i + 2] > 1e-6) expect(points.has(key(p[i], p[i + 1], -p[i + 2]))).toBe(true);
    }
  });

  it('has a silhouette with two wheels and glass', () => {
    const s = carSilhouette(type);
    expect(s.wheels).toHaveLength(2);
    expect(s.body).toMatch(/^M.*Z$/);
    expect(s.glass).not.toBe('');
  });
});

it('the seven bodies differ', () => {
  const signatures = BODY_TYPES.map((t) => {
    const g = bodyGeometry(t);
    return `${g.length}|${g.width}|${carSilhouette(t).body}`;
  });
  expect(new Set(signatures).size).toBe(BODY_TYPES.length);
});
