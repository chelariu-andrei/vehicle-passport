import AsyncStorage from '@react-native-async-storage/async-storage';

/** Where sign-up leaves the accepted terms until the first signed-in session can record them. */
export const PENDING_CONSENT_KEY = 'auth.pendingConsent';

export interface PendingConsent {
  termsAccepted: true;
}

export async function rememberPendingConsent(): Promise<void> {
  const consent: PendingConsent = { termsAccepted: true };
  await AsyncStorage.setItem(PENDING_CONSENT_KEY, JSON.stringify(consent));
}

export async function readPendingConsent(): Promise<PendingConsent | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_CONSENT_KEY);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && (parsed as PendingConsent).termsAccepted === true ? { termsAccepted: true } : null;
  } catch {
    return null;
  }
}

export async function clearPendingConsent(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_CONSENT_KEY);
}
