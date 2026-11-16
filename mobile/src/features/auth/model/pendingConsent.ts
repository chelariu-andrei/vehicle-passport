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
