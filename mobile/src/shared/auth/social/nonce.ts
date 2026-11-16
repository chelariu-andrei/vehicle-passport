/* A nonce ties an Apple identity token to the request that asked for it: Apple gets the hash, Supabase the raw value. */
import * as Crypto from 'expo-crypto';

export async function createNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = Crypto.getRandomBytes(32);
  const raw = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}
