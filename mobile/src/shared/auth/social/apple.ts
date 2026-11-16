/* Sign in with Apple (iOS only). */
import * as AppleAuthentication from 'expo-apple-authentication';

import { createNonce } from './nonce';

export interface AppleCredential {
  idToken: string;
  /** The raw nonce, for Supabase. */
  nonce: string;
  /** Apple reports the name on the first sign-in only. */
  fullName?: string;
}

/** Resolves null when the person cancelled. Throws for any other failure. */
export async function getAppleCredential(): Promise<AppleCredential | null> {
  const { raw, hashed } = await createNonce();
  let result: AppleAuthentication.AppleAuthenticationCredential;
  try {
    result = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw error;
  }
  if (!result.identityToken) throw new Error('Apple returned no identity token');
  const name = [result.fullName?.givenName, result.fullName?.familyName].filter(Boolean).join(' ');
  return { idToken: result.identityToken, nonce: raw, ...(name ? { fullName: name } : {}) };
}
