export const qk = {
  me: ['me'] as const,
  settings: ['settings'] as const,
  consents: ['consents'] as const,
  vehicles: ['vehicles'] as const,
  vehicle: (vin: string) => ['vehicle', vin] as const,
  timeline: (vin: string) => ['timeline', vin] as const,
  /** The full timeline's pages and summary sit under `timeline(vin)`, so invalidating that refreshes them too. `F` is the event feature's filters (shared cannot import a feature). */
  timelinePages: <F>(vin: string, f: F) => ['timeline', vin, 'pages', f] as const,
  timelineSummary: <F>(vin: string, f: F) => ['timeline', vin, 'summary', f] as const,
  /** Under `timeline(vin)`, so every event change (which invalidates the timeline) refreshes the document status too, and forgetting a car removes it. */
  deadlines: (vin: string) => ['timeline', vin, 'deadlines'] as const,
  /** The date of the car's latest tire change, for the tire-season reminders. Under `timeline(vin)` for the same reason. */
  lastTires: (vin: string) => ['timeline', vin, 'lastTires'] as const,
  /** All fuel data of a car; stats sit under it so one invalidation refreshes list and stats. */
  fuel: (vin: string) => ['fuel', vin] as const,
  fuelStats: (vin: string, period: string) => ['fuel', vin, 'stats', period] as const,
  attachments: (vin: string, eventId: string) => ['attachments', vin, eventId] as const,
  claims: (vin: string) => ['claims', vin] as const,
  scan: (jobId: string) => ['scan', jobId] as const,
  passports: ['passports'] as const,
  activeCar: (userId: string) => ['activeCar', userId] as const,
  journeyDraft: (userId: string) => ['journeyDraft', userId] as const,
  legalDocuments: (locale: string) => ['legalDocuments', locale] as const,
  legalDocument: (type: string, locale: string) => ['legalDocument', type, locale] as const,
};
