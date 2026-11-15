import {
  NEUTRAL_LOOK, PALETTE, BODY_TYPES, appearanceOf, hasLook, lookOf, normalisePlate, paintHex, plateToSend, shade,
} from './look';

const CONTRACT_PLATE = /^[A-Z0-9](?:[A-Z0-9 -]{0,8}[A-Z0-9])?$/;

describe('plate', () => {
  it('normalises while typing', () => {
    expect(normalisePlate(' b  123 abc ')).toBe('B 123 ABC ');
    expect(normalisePlate('b-12🙂abc')).toBe('B-12ABC');
    expect(normalisePlate('AB 12 CDE FGH IJ')).toHaveLength(10);
  });
  it('trims for sending', () => {
    expect(plateToSend('B 123 ABC ')).toBe('B 123 ABC');
    expect(plateToSend('   ')).toBeNull();
    expect(plateToSend('')).toBeNull();
    expect(plateToSend('-')).toBeNull();
  });
  it('every sent plate matches the contract pattern', () => {
    const inputs = ['B 123 ABC ', 'ab-', '-ab', ' - a - ', 'A', 'AB 12 CDE FGH IJ', 'a-b-c-d-e-f-g-h', '12 34 56 78 ', 'x  -  y', '!!a--'];
    inputs.forEach((input) => {
      const sent = plateToSend(normalisePlate(input));
      if (sent !== null) expect(sent).toMatch(CONTRACT_PLATE);
    });
  });
});

describe('look', () => {
  it('falls back to the neutral look', () => {
    expect(lookOf({})).toEqual(NEUTRAL_LOOK);
    expect(lookOf({ appearance: null, plate: null })).toEqual(NEUTRAL_LOOK);
    expect(NEUTRAL_LOOK.bodyType).toBeNull();
  });
  it('overlays the stored fields', () => {
    expect(lookOf({ appearance: { bodyType: 'SUV', color: 'BLUE' }, plate: 'CJ 45 DUS' }))
      .toMatchObject({ bodyType: 'SUV', color: 'BLUE', finish: 'GLOSS', plate: 'CJ 45 DUS' });
  });
  it('omits unset optional fields when sending', () => {
    expect(appearanceOf(NEUTRAL_LOOK)).not.toHaveProperty('bodyType');
    expect(appearanceOf({ ...NEUTRAL_LOOK, colorHex: null })).not.toHaveProperty('colorHex');
    expect(appearanceOf({ ...NEUTRAL_LOOK, bodyType: 'SEDAN', colorHex: '#112233' })).toMatchObject({ bodyType: 'SEDAN', colorHex: '#112233' });
  });
  it('knows whether a look was chosen', () => {
    expect(hasLook({ appearance: null })).toBe(false);
    expect(hasLook({ appearance: {} })).toBe(false);
    expect(hasLook({})).toBe(false);
    expect(hasLook({ appearance: { color: 'RED' } })).toBe(true);
  });
  it('shades map to a named colour', () => {
    expect(shade(210, 0.42)).toEqual({ colorHex: expect.stringMatching(/^#[0-9a-f]{6}$/), color: 'BLUE' });
    expect(shade(0, 0.42).color).toBe('RED');
  });
  it('paints with the custom hex or the palette hex', () => {
    expect(paintHex({ ...NEUTRAL_LOOK, colorHex: '#123456' })).toBe('#123456');
    expect(paintHex({ ...NEUTRAL_LOOK, color: 'RED' })).toBe(PALETTE.find((p) => p.code === 'RED')?.hex);
  });
  it('exposes the seven bodies and twelve colours', () => {
    expect(BODY_TYPES).toHaveLength(7);
    expect(PALETTE).toHaveLength(12);
  });
});
