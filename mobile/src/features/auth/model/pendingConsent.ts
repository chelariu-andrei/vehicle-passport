import AsyncStorage from '@react-native-async-storage/async-storage';

/** Where sign-up leaves the accepted terms until the first signed-in session can record them. */
export const PENDING_CONSENT_KEY = 'auth.pendingConsent';
/** A sign-up that is not confirmed within a week no longer speaks for anyone. */
export const PENDING_CONSENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The acceptance belongs to the account that signed up with this email, and to nobody else. */
export interface PendingConsent {
  termsAccepted: true;
  /** Normalised: trimmed and lower-cased. */
  email: string;
  /** Epoch milliseconds when the terms were accepted. */
  at: number;
}

export const normaliseEmail = (email: string): string => email.trim().toLowerCase();

export async function rememberPendingConsent(email: string): Promise<void> {
  const consent: PendingConsent = { termsAccepted: true, email: normaliseEmail(email), at: Date.now() };
  await AsyncStorage.setItem(PENDING_CONSENT_KEY, JSON.stringify(consent));
}

function isPending(value: unknown): value is PendingConsent {
  if (typeof value !== 'object' || value === null) return false;
  const { termsAccepted, email, at } = value as Partial<PendingConsent>;
  return termsAccepted === true && typeof email === 'string' && email !== '' && typeof at === 'number';
}

/** The remembered acceptance, or null: nothing stored, the old shape without an email, or older than a week (then forgotten). */
export async function readPendingConsent(): Promise<PendingConsent | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_CONSENT_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isPending(parsed) && Date.now() - parsed.at <= PENDING_CONSENT_TTL_MS) return parsed;
    await AsyncStorage.removeItem(PENDING_CONSENT_KEY);
    return null;
  } catch {
    return null;
  }
}

export const matchesAccount = (pending: PendingConsent | null, sessionEmail: string | null): boolean =>
  pending !== null && sessionEmail !== null && pending.email === normaliseEmail(sessionEmail);

export async function clearPendingConsent(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_CONSENT_KEY);
}
