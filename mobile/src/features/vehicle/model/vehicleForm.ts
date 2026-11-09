import { z } from 'zod';

import type { components } from '@/shared/api/generated/schema';

export type FuelType = components['schemas']['FuelType'];
export const FUEL_TYPES: readonly FuelType[] = ['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC', 'LPG', 'OTHER'];

const VIN = /^[A-HJ-NPR-Z0-9]{17}$/;
const FIRST_YEAR = 1886;

/**
 * The Add vehicle form as the contract accepts it. The VIN is uppercased, not check-digit tested.
 * `year` takes a number or the text typed into the field. An empty engine is left out of the result.
 */
export function vehicleFormSchema(now: Date) {
  const form = z.object({
    vin: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(z.string().regex(VIN)),
    make: z.string().trim().min(1).max(100),
    model: z.string().trim().min(1).max(100),
    engine: z
      .string()
      .trim()
      .max(100)
      .optional(),
    year: z.coerce
      .number()
      .int()
      .min(FIRST_YEAR)
      .max(now.getFullYear() + 1),
    fuel: z.enum(FUEL_TYPES),
  });
  // An empty engine is dropped, not sent as "": the contract's field is optional.
  return form.transform(({ engine, ...rest }): z.output<typeof form> => (engine ? { ...rest, engine } : rest));
}

export type VehicleFormValues = z.output<ReturnType<typeof vehicleFormSchema>>;
