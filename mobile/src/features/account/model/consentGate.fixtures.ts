import type { Me } from './consentGate';

/** A profile whose consent is owed or not; only what the gate reads matters. */
export function aMeFor(required: boolean): Me {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'me@example.com',
    emailVerified: true,
    displayName: null,
    phone: null,
    createdAt: '2026-01-01T00:00:00Z',
    stats: { vehicles: 0, events: 0, passports: 0 },
    deletion: null,
    consent: {
      required,
      terms: { currentVersion: '1.0', acceptedVersion: required ? null : '1.0' },
      privacy: { currentVersion: '1.0', acceptedVersion: required ? null : '1.0' },
      marketing: false,
      analytics: false,
    },
  };
}
