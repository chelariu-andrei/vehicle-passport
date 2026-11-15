import { tokens } from './tokens.generated';

describe('generated tokens', () => {
  it('resolves the {brand} alias per theme', () => {
    expect(tokens.color.dark.focus).toBe(tokens.color.dark.brand);
    expect(tokens.color.light['evidence-documented']).toBe(tokens.color.light.brand);
  });

  it('keeps per-theme colours', () => {
    expect(tokens.color.light.bg).toBe('#f2f5f3');
    expect(tokens.color.dark.bg).toBe('#050706');
    expect(tokens.color.dark['bg-lift']).toBe('#0c110f');
    expect(tokens.color.dark['edge-light']).toBe('#ffffff14');
    expect(tokens.color.light['ground-shade']).toBe('#dfe6e2');
  });

  it('uses the same value in both themes for a plain string', () => {
    expect(tokens.color.dark['brand-deep']).toBe(tokens.color.light['brand-deep']);
  });

  it('converts type px to numbers and em to points', () => {
    expect(tokens.type['display-xl']).toMatchObject({ fontSize: 44, lineHeight: 48, fontWeight: 700 });
    expect(tokens.type.vin.letterSpacing).toBeCloseTo(0.9);
    expect(tokens.type['display-xl'].letterSpacing).toBeCloseTo(-1.32);
    expect(tokens.type.body.letterSpacing).toBe(0);
  });

  it('records the font family of each style', () => {
    expect(tokens.type.vin.family).toBe('mono');
    expect(tokens.type.title.family).toBe('display');
    expect(tokens.type.body.family).toBe('sans');
  });

  it('converts spacing and radius to numbers', () => {
    expect(tokens.space['space-4']).toBe(16);
    expect(tokens.radius['radius-pill']).toBe(999);
  });

  it('keeps shadows as boxShadow strings per theme', () => {
    expect(tokens.shadow.light['shadow-card']).toBe('0 1px 0 0 #08120d0a, 0 10px 28px -8px #08120d24');
  });
});
