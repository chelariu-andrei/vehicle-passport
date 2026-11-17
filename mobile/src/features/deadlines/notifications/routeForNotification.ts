/**
 * Where a tapped reminder leads: the Document status screen of its car. Anything but a payload with a non-empty string
 * `vin` leads nowhere, so a malformed notification never navigates.
 */
export function routeForNotification(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const vin = (data as { vin?: unknown }).vin;
  if (typeof vin !== 'string' || vin === '') return null;
  return `/vehicles/${encodeURIComponent(vin)}/deadlines`;
}
