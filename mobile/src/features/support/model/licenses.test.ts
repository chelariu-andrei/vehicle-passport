import { packages, texts } from './licenses';

describe('generated licences', () => {
  it('lists the production closure, not only the direct dependencies', () => {
    const names = packages.map((pkg) => pkg.name);
    expect(names).toContain('expo-router');
    expect(names).toContain('react');
    expect(packages.length).toBeGreaterThan(300);
  });

  it('gives every package its licence text', () => {
    for (const pkg of packages) {
      expect(pkg.textId).not.toBeNull();
      expect(texts[pkg.textId as string]).toBeTruthy();
    }
  });

  it('marks generated text and only generates from the declared licence', () => {
    const generated = packages.filter((pkg) => pkg.generatedFrom);
    expect(generated.length).toBeGreaterThan(0);
    for (const pkg of generated) expect(pkg.license).toContain(pkg.generatedFrom as string);
    expect(texts[packages.find((pkg) => pkg.name === 'expo-router')!.textId as string]).toMatch(/^MIT License\n\nCopyright \(c\) .+/);
  });

  it('is sorted by name then version and has no duplicates', () => {
    const keys = packages.map((pkg) => `${pkg.name}@${pkg.version}`);
    expect(new Set(keys).size).toBe(keys.length);
    const sorted = [...packages].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.version < b.version ? -1 : a.version > b.version ? 1 : 0));
    expect(packages.map((pkg) => `${pkg.name}@${pkg.version}`)).toEqual(sorted.map((pkg) => `${pkg.name}@${pkg.version}`));
  });

  it('holds no absolute paths or backslashes in the package metadata', () => {
    for (const pkg of packages) {
      for (const value of [pkg.name, pkg.version, pkg.license, pkg.repository ?? '']) expect(value).not.toMatch(/\\|^[A-Za-z]:|^file:|^\/|\/Users\/|\/home\//);
      if (pkg.repository) expect(pkg.repository).toMatch(/^https:\/\//);
    }
    expect(Object.keys(texts).every((id) => /^[0-9a-f]{10}$/.test(id))).toBe(true);
  });
});
