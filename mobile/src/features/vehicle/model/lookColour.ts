export const HUE_MAX = 360;
export const LIGHTNESS_MIN = 0.12;
export const LIGHTNESS_MAX = 0.78;

/** Where a `#rrggbb` colour sits on the hue and lightness tracks, kept inside their ranges. */
export function hueAndLightness(hex: string): { hue: number; lightness: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }
  const lightness = (max + min) / 2;
  return { hue, lightness: Math.min(LIGHTNESS_MAX, Math.max(LIGHTNESS_MIN, lightness)) };
}
