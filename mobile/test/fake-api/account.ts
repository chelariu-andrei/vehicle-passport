/* Fake handlers for the account operations (profile, settings, consents, deletion, export, support). */
import type { components } from '@/shared/api/generated/schema';
import type { Ctx, FakeState, Handler, Reply } from './handlers';

type Schemas = components['schemas'];

/** The current terms and privacy version the fake server publishes. */
export const CURRENT_LEGAL_VERSION = '1.0';
const GRACE_DAYS = 30;
const PHONE = /^\+[1-9]\d{6,14}$/;
const PROBLEM = 'application/problem+json';

export interface AccountState {
  email: string | null;
  displayName: string | null;
  phone: string | null;
  createdAt: string;
  settings: Schemas['SettingsDto'];
  accepted: { terms: string | null; privacy: string | null };
  marketing: boolean;
  analytics: boolean;
  /** Oldest first; the history endpoint answers newest first. */
  history: Schemas['ConsentEvent'][];
  /** When the purge is scheduled, or null. */
  deletion: string | null;
  support: Schemas['SupportReportExport'][];
}

export function initialAccount(): AccountState {
  return {
    email: 'me@example.com',
    displayName: null,
    phone: null,
    createdAt: '2026-01-01T00:00:00Z',
    settings: {
      language: 'system',
      appearance: 'system',
      units: { distance: 'km', currency: 'RON' },
      notifications: {
        documentDeadlines: true,
        reminderDays: [30, 7, 1],
        activityScans: true,
        activityPassportViews: true,
        activityTransfers: true,
        productNews: false,
      },
    },
    accepted: { terms: null, privacy: null },
    marketing: false,
    analytics: false,
    history: [],
    deletion: null,
    support: [],
  };
}

const problem = (status: number, code: string): Reply => ({
  status,
  contentType: PROBLEM,
  body: { type: `urn:vehicle-passport:${code}`, title: code, status, detail: code, code },
});
const ok = (body: unknown, status = 200): Reply => ({ status, body });

function consentStatus(a: AccountState): Schemas['ConsentStatus'] {
  const terms = { currentVersion: CURRENT_LEGAL_VERSION, acceptedVersion: a.accepted.terms };
  const privacy = { currentVersion: CURRENT_LEGAL_VERSION, acceptedVersion: a.accepted.privacy };
  return {
    required: terms.acceptedVersion !== terms.currentVersion || privacy.acceptedVersion !== privacy.currentVersion,
    terms,
    privacy,
    marketing: a.marketing,
    analytics: a.analytics,
  };
}

function me(state: FakeState): Schemas['MeResponse'] {
  const a = state.account;
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: a.email,
    emailVerified: true,
    displayName: a.displayName,
    phone: a.phone,
    createdAt: a.createdAt,
    stats: {
      vehicles: state.vehicles.length,
      events: Object.values(state.events).reduce((n, list) => n + list.length, 0),
      passports: state.passports.length,
    },
    deletion: a.deletion === null ? null : { scheduledFor: a.deletion },
    consent: consentStatus(a),
  };
}

const getMe: Handler = (c) => ok(me(c.state));

const updateProfile: Handler = (c) => {
  const a = c.state.account;
  const body = c.body ?? {};
  let displayName = a.displayName;
  let phone = a.phone;
  if ('displayName' in body) {
    if (body.displayName === null) displayName = null;
    else {
      const trimmed = String(body.displayName).trim();
      if (trimmed.length < 1 || trimmed.length > 80) return problem(400, 'validation-failed');
      displayName = trimmed;
    }
  }
  if ('phone' in body) {
    if (body.phone === null) phone = null;
    else if (!PHONE.test(String(body.phone))) return problem(400, 'validation-failed');
    else phone = String(body.phone);
  }
  a.displayName = displayName;
  a.phone = phone;
  return ok(me(c.state));
};

const getSettings: Handler = (c) => ok(c.state.account.settings);

const updateSettings: Handler = (c) => {
  c.state.account.settings = c.body as Schemas['SettingsDto'];
  return ok(c.state.account.settings);
};

const getConsentStatus: Handler = (c) => ok(consentStatus(c.state.account));

const recordConsents: Handler = (c) => {
  const a = c.state.account;
  const body = c.body as Schemas['ConsentUpdate'];
  const accept = body.accept ?? [];
  if (accept.some((x) => x.version !== CURRENT_LEGAL_VERSION)) return problem(409, 'consent-version-outdated');
  const at = new Date().toISOString();
  for (const x of accept) {
    a.accepted[x.type] = x.version;
    a.history.push({ type: x.type, version: x.version, granted: true, source: body.source, at });
  }
  for (const key of ['marketing', 'analytics'] as const) {
    const wanted = body[key];
    if (wanted !== undefined && wanted !== a[key]) {
      a[key] = wanted;
      a.history.push({ type: key, version: null, granted: wanted, source: body.source, at });
    }
  }
  return ok(consentStatus(a));
};

const listConsentHistory: Handler = (c) => ok({ items: [...c.state.account.history].reverse() });

const scheduleDeletion: Handler = (c) => {
  const a = c.state.account;
  if (a.deletion !== null) return problem(409, 'deletion-already-scheduled');
  a.deletion = new Date(Date.now() + GRACE_DAYS * 86_400_000).toISOString();
  return ok({ scheduledFor: a.deletion }, 201);
};

const cancelDeletion: Handler = (c) => {
  const a = c.state.account;
  if (a.deletion === null) return problem(404, 'deletion-not-scheduled');
  a.deletion = null;
  return { status: 204 };
};

const exportMyData: Handler = (c: Ctx) => ({
  status: 200,
  body: {
    exportedAt: new Date().toISOString(),
    profile: me(c.state),
    settings: c.state.account.settings,
    consents: [...c.state.account.history].reverse(),
    vehicles: c.state.vehicles,
    events: Object.entries(c.state.events).flatMap(([vin, list]) => list.map((e) => ({ ...e, vin }))),
    passports: c.state.passports,
    supportReports: c.state.account.support,
  },
});

const createSupportReport: Handler = (c) => {
  const body = c.body as Schemas['SupportReportRequest'];
  c.state.account.support.push({
    kind: body.kind,
    message: body.message.trim(),
    diagnostics: body.includeDiagnostics ? (body.diagnostics ?? null) : null,
    createdAt: new Date().toISOString(),
  });
  return ok({ id: globalThis.crypto.randomUUID() }, 201);
};

export const accountHandlers: Record<string, Handler> = {
  getMe,
  updateProfile,
  getSettings,
  updateSettings,
  getConsentStatus,
  recordConsents,
  listConsentHistory,
  scheduleDeletion,
  cancelDeletion,
  exportMyData,
  createSupportReport,
};
