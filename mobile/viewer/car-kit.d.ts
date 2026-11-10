export type BodyTypeCode = 'HATCHBACK' | 'SEDAN' | 'ESTATE' | 'SUV' | 'COUPE' | 'MPV' | 'PICKUP';
export type PaintCode =
  | 'WHITE' | 'BLACK' | 'SILVER' | 'GREY' | 'BLUE' | 'RED' | 'GREEN' | 'BEIGE' | 'BROWN' | 'YELLOW' | 'ORANGE' | 'GOLD';

export const BODY_TYPES: readonly BodyTypeCode[];
export const BODY_LABELS: Record<BodyTypeCode, string>;
export const PALETTE: readonly { code: PaintCode; name: string; hex: string }[];
export const FINISHES: readonly string[];
export const WHEEL_STYLES: readonly string[];
export const RIM_COLORS: readonly string[];
export const GLASS_TINTS: readonly string[];

export type KitLook = {
  bodyType?: BodyTypeCode | null; color?: PaintCode; colorHex?: string | null; finish?: string;
  wheels?: string; rimColor?: string; glassTint?: string; contrastRoof?: boolean; plate?: string;
};

export function carSilhouette(bodyType: BodyTypeCode | null | undefined): {
  viewBox: string; body: string; glass: string; wheels: { cx: number; cy: number; r: number }[];
};
export function bodyGeometry(bodyType: BodyTypeCode | null | undefined): {
  positions: Float32Array; lists: ArrayLike<number>[]; length: number; width: number;
};
export function nearestPaletteCode(hex: string): PaintCode;
export function resolveHex(look: KitLook): string;
export function createCarKit(three: unknown): {
  createCar(look?: KitLook): { group: unknown; apply(look: KitLook): void; [key: string]: unknown };
  [key: string]: unknown;
};
