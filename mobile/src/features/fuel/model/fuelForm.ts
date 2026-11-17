import type { components } from '@/shared/api/generated/schema';

export type FuelEntryType = components['schemas']['FuelEntryType'];
export type FuelGrade = components['schemas']['FuelGrade'];
export type ChargeType = components['schemas']['ChargeType'];
export type FuelEntryRequest = components['schemas']['FuelEntryRequest'];

export type AmountField = 'quantity' | 'unitPrice' | 'total';

export type FuelFormState = {
  date: string;
  odometerKm: string;
  fuelType: FuelEntryType | null;
  quantity: string;
  unitPrice: string;
  total: string;
  /** The amount fields the user edited last, oldest first; at most two. The third one is computed. */
  touched: AmountField[];
  fullTank: boolean;
  missedPrevious: boolean;
  grade: FuelGrade | null;
  chargeType: ChargeType | null;
  station: string;
  note: string;
  currency: string;
};

export type FuelFormContext = { lastKm: number | null; isElectric: boolean };

export type FuelFormValidation = {
  /** Error codes by field: `required` or `invalid`. */
  errors: Partial<Record<keyof FuelFormState, 'required' | 'invalid'>>;
  hints: { odometer?: 'below-last' };
  /** True when the quantity is above a sane tank (200 L, or 150 kWh) and the user should confirm it once. */
  confirmLargeQuantity: boolean;
};

const DECIMAL = /^\d+(?:\.\d+)?$/;
const MAX_LITRES = 200;
const MAX_KWH = 150;

/** Accepts `.` and `,` as the separator. Empty, half-typed ("38,"), negative or non-numeric input is null. */
export function parseDecimal(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (!DECIMAL.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

function show(n: number, digits: number): string {
  return Number.isFinite(n) ? String(round(n, digits)) : '';
}

/** Sets one amount field and recomputes the one the user did not touch last. */
export function editAmount(state: FuelFormState, field: AmountField, raw: string): FuelFormState {
  const touched = [...state.touched.filter((f) => f !== field), field].slice(-2) as AmountField[];
  const next: FuelFormState = { ...state, [field]: raw, touched };
  if (touched.length < 2) return next;

  const computed = (['quantity', 'unitPrice', 'total'] as const).find((f) => !touched.includes(f))!;
  const quantity = parseDecimal(next.quantity);
  const unitPrice = parseDecimal(next.unitPrice);
  const total = parseDecimal(next.total);
  if (computed === 'unitPrice' && quantity !== null && total !== null) {
    return { ...next, unitPrice: show(total / quantity, 3) };
  }
  if (computed === 'total' && quantity !== null && unitPrice !== null) {
    return { ...next, total: show(quantity * unitPrice, 2) };
  }
  if (computed === 'quantity' && unitPrice !== null && total !== null) {
    return { ...next, quantity: show(total / unitPrice, 3) };
  }
  return next;
}

export function validateFuelForm(state: FuelFormState, ctx: FuelFormContext): FuelFormValidation {
  const errors: FuelFormValidation['errors'] = {};
  const hints: FuelFormValidation['hints'] = {};

  const km = /^\d+$/.test(state.odometerKm.trim()) ? Number(state.odometerKm.trim()) : null;
  if (state.odometerKm.trim() === '') errors.odometerKm = 'required';
  else if (km === null) errors.odometerKm = 'invalid';
  else if (ctx.lastKm !== null && km < ctx.lastKm) hints.odometer = 'below-last';

  const quantity = parseDecimal(state.quantity);
  if (state.quantity.trim() === '') errors.quantity = 'required';
  else if (quantity === null || quantity <= 0) errors.quantity = 'invalid';

  if (state.total.trim() === '') errors.total = 'required';
  else if (parseDecimal(state.total) === null) errors.total = 'invalid';

  if (state.fuelType === null) errors.fuelType = 'required';

  const limit = ctx.isElectric ? MAX_KWH : MAX_LITRES;
  return { errors, hints, confirmLargeQuantity: quantity !== null && quantity > limit };
}

/** The request for a form that passed `validateFuelForm`. The unit price is derived and never sent. */
export function toFuelEntryRequest(state: FuelFormState): FuelEntryRequest {
  const electric = state.fuelType === 'ELECTRIC';
  const station = state.station.trim();
  const note = state.note.trim();
  return {
    date: state.date,
    odometerKm: Number(state.odometerKm.trim()),
    fuelType: state.fuelType!,
    quantity: parseDecimal(state.quantity)!,
    total: parseDecimal(state.total)!,
    currency: state.currency,
    fullTank: state.fullTank,
    missedPrevious: state.missedPrevious,
    ...(!electric && state.grade ? { grade: state.grade } : {}),
    ...(electric && state.chargeType ? { chargeType: state.chargeType } : {}),
    ...(station ? { station } : {}),
    ...(note ? { note } : {}),
  };
}
