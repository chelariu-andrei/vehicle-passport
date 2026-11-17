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
  attachments: (vin: string, eventId: string) => ['attachments', vin, eventId] as const,
  claims: (vin: string) => ['claims', vin] as const,
  scan: (jobId: string) => ['scan', jobId] as const,
  passports: ['passports'] as const,
  activeCar: (userId: string) => ['activeCar', userId] as const,
  journeyDraft: (userId: string) => ['journeyDraft', userId] as const,
  legalDocuments: (locale: string) => ['legalDocuments', locale] as const,
  legalDocument: (type: string, locale: string) => ['legalDocument', type, locale] as const,
};
