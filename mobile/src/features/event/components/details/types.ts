import type { components } from '@/shared/api/generated/schema';

export type DetailsOutput = components['schemas']['EventDetailsOutput'];
/** The details variant for one `kind`. */
export type DetailsOf<K extends DetailsOutput['kind']> = Extract<DetailsOutput, { kind: K }>;
