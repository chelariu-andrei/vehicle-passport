export const qk = {
  vehicles: ['vehicles'] as const,
  vehicle: (vin: string) => ['vehicle', vin] as const,
  timeline: (vin: string) => ['timeline', vin] as const,
  claims: (vin: string) => ['claims', vin] as const,
  scan: (jobId: string) => ['scan', jobId] as const,
  passports: ['passports'] as const,
};
