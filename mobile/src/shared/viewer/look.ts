import type { components } from '@/shared/api/generated/schema';
import { BODY_TYPES as KIT_BODY_TYPES, PALETTE as KIT_PALETTE, nearestPaletteCode } from '../../../viewer/car-kit';

export type Appearance = components['schemas']['VehicleAppearance'];
export type BodyType = components['schemas']['BodyType'];
export type PaintColor = components['schemas']['PaintColor'];

export type Look = {
  bodyType: BodyType | null;
  color: PaintColor;
  colorHex: string | null;
  finish: components['schemas']['PaintFinish'];
  wheels: components['schemas']['WheelStyle'];
  rimColor: components['schemas']['RimColor'];
  glassTint: components['schemas']['GlassTint'];
  contrastRoof: boolean;
  plate: string;
};

export const NEUTRAL_LOOK: Look = {
  bodyType: null,
  color: 'GREY',
  colorHex: null,
  finish: 'GLOSS',
  wheels: 'FIVE_SPOKE',
  rimColor: 'SILVER',
  glassTint: 'LIGHT',
  contrastRoof: false,
  plate: '',
};

export const PALETTE: readonly { code: PaintColor; name: string; hex: string }[] = KIT_PALETTE;
export const BODY_TYPES: readonly BodyType[] = KIT_BODY_TYPES;

export function lookOf(vehicle: { appearance?: Appearance | null; plate?: string | null }): Look {
  const a = vehicle.appearance ?? {};
  return {
    bodyType: a.bodyType ?? NEUTRAL_LOOK.bodyType,
    color: a.color ?? NEUTRAL_LOOK.color,
    colorHex: a.colorHex ?? NEUTRAL_LOOK.colorHex,
    finish: a.finish ?? NEUTRAL_LOOK.finish,
    wheels: a.wheels ?? NEUTRAL_LOOK.wheels,
    rimColor: a.rimColor ?? NEUTRAL_LOOK.rimColor,
    glassTint: a.glassTint ?? NEUTRAL_LOOK.glassTint,
    contrastRoof: a.contrastRoof ?? NEUTRAL_LOOK.contrastRoof,
    plate: vehicle.plate ?? NEUTRAL_LOOK.plate,
  };
}

export function appearanceOf(look: Look): Appearance {
  const { bodyType, colorHex, color, finish, wheels, rimColor, glassTint, contrastRoof } = look;
  return {
    ...(bodyType ? { bodyType } : {}),
    color,
    ...(colorHex ? { colorHex } : {}),
    finish,
    wheels,
    rimColor,
    glassTint,
    contrastRoof,
  };
}

export function hasLook(vehicle: { appearance?: Appearance | null }): boolean {
  return Object.keys(vehicle.appearance ?? {}).length > 0;
}

const PLATE_MAX = 10;

/** While typing: upper-case, only A-Z 0-9 space hyphen, single spaces, no leading space, at most 10. */
export function normalisePlate(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, '')
    .replace(/ {2,}/g, ' ')
    .replace(/^ +/, '')
    .slice(0, PLATE_MAX);
}

/**
 * For the API: normalised, then leading/trailing spaces and hyphens removed, so the result always matches the
 * contract pattern ^[A-Z0-9](?:[A-Z0-9 -]{0,8}[A-Z0-9])?$. Nothing left means no plate (null).
 */
export function plateToSend(text: string): string | null {
  const plate = normalisePlate(text).replace(/^[ -]+|[ -]+$/g, '');
  return plate === '' ? null : plate;
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export function shade(hue: number, lightness: number): { colorHex: string; color: PaintColor } {
  const colorHex = hslToHex(((hue % 360) + 360) % 360, 0.62, lightness);
  return { colorHex, color: nearestPaletteCode(colorHex) };
}

export function paintHex(look: Look): string {
  return look.colorHex ?? PALETTE.find((p) => p.code === look.color)?.hex ?? PALETTE[3].hex;
}
