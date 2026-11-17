import type { SnapshotEvent } from './snapshot.ts';

export type ValidityStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'SUPERSEDED' | 'UNKNOWN';

/** Same threshold as the server (spec 5.6). */
export const EXPIRING_DAYS = 30;

const DAY_MS = 86_400_000;

/** Whole days from `from` to `to`, both `YYYY-MM-DD`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function groupOf(e: SnapshotEvent): string | null {
  switch (e.details?.kind) {
    case 'INSURANCE':
      return e.details.coverage; // RCA | CASCO
    case 'SAFETY_EQUIPMENT':
      return e.details.item === 'FIRE_EXTINGUISHER' ? 'EXTINGUISHER' : 'FIRST_AID';
    case 'ROVINIETA':
      return 'ROVINIETA';
    case 'ITP':
      return 'ITP';
    default:
      return e.type === 'ITP' ? 'ITP' : null;
  }
}

/**
 * Validity status per event, from the snapshot alone (spec 5.6). Events whose type has no validity are absent
 * from the result. Snapshot events carry no createdAt, so a tie on validFrom (the event date when validFrom is
 * absent) is won by the later event in the array. `today` is `YYYY-MM-DD`.
 */
export function validityStatuses(events: SnapshotEvent[], today: string): Map<SnapshotEvent, ValidityStatus> {
  const current = new Map<string, SnapshotEvent>();
  const from = (e: SnapshotEvent) => e.validFrom ?? e.date ?? '';
  for (const e of events) {
    const group = groupOf(e);
    if (group === null) continue;
    const best = current.get(group);
    if (best === undefined || from(e) >= from(best)) current.set(group, e);
  }
  const result = new Map<SnapshotEvent, ValidityStatus>();
  for (const e of events) {
    const group = groupOf(e);
    if (group === null) continue;
    if (current.get(group) !== e) result.set(e, 'SUPERSEDED');
    else if (e.validUntil === null) result.set(e, 'UNKNOWN');
    else if (e.validUntil < today) result.set(e, 'EXPIRED');
    else result.set(e, daysBetween(today, e.validUntil) <= EXPIRING_DAYS ? 'EXPIRING' : 'VALID');
  }
  return result;
}
