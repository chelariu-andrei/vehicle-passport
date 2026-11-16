import type { components } from '@/shared/api/generated/schema';

export type Me = components['schemas']['MeResponse'];
export type Gate = 'open' | 'consent' | 'loading' | 'error';

/**
 * What the app may show a signed-in person. The app opens only on a profile that says no consent is owed.
 * `pending`: the sign-up acceptance still to be recorded (undefined while it is being read, null when there is none).
 * A failed or missing profile never opens the app, and never accepts anything.
 */
export function resolveGate(me: { data?: Me; isError: boolean }, pending: unknown): Gate {
  if (pending === undefined) return 'loading';
  if (me.data === undefined) return me.isError ? 'error' : 'loading';
  if (!me.data.consent.required) return 'open';
  // The sign-up acceptance is being recorded; the gate would only flash.
  return pending === null ? 'consent' : 'loading';
}
