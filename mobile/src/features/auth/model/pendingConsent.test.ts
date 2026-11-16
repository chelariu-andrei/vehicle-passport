import AsyncStorage from '@react-native-async-storage/async-storage';

import { PENDING_CONSENT_KEY, PENDING_CONSENT_TTL_MS, matchesAccount, readPendingConsent, rememberPendingConsent, shownVersionsMatch } from './pendingConsent';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('pending consent', () => {
  it('remembers the normalised sign-up email and matches only that account', async () => {
    await rememberPendingConsent('  Ana@Example.COM ');
    const pending = await readPendingConsent();
    expect(pending).toMatchObject({ termsAccepted: true, email: 'ana@example.com' });
    expect(matchesAccount(pending, 'ANA@example.com')).toBe(true);
    expect(matchesAccount(pending, 'other@example.com')).toBe(false);
    expect(matchesAccount(pending, null)).toBe(false);
  });

  it('keeps the versions shown, and matches only the same ones; unknown versions never match', async () => {
    await rememberPendingConsent('ana@example.com', { terms: '1.0', privacy: '1.0' });
    const shown = (await readPendingConsent())!;
    expect(shownVersionsMatch(shown, { terms: '1.0', privacy: '1.0' })).toBe(true);
    expect(shownVersionsMatch(shown, { terms: '2.0', privacy: '1.0' })).toBe(false);
    expect(shownVersionsMatch(shown, { terms: '1.0', privacy: '1.1' })).toBe(false);
    await rememberPendingConsent('ana@example.com', null);
    expect(shownVersionsMatch((await readPendingConsent())!, { terms: '1.0', privacy: '1.0' })).toBe(false);
  });

  it('reads the old shape without an email as nothing pending', async () => {
    await AsyncStorage.setItem(PENDING_CONSENT_KEY, JSON.stringify({ termsAccepted: true }));
    expect(await readPendingConsent()).toBeNull();
  });

  it('forgets a flag older than the time to live', async () => {
    await AsyncStorage.setItem(
      PENDING_CONSENT_KEY,
      JSON.stringify({ termsAccepted: true, email: 'ana@example.com', at: Date.now() - PENDING_CONSENT_TTL_MS - 1 }),
    );
    expect(await readPendingConsent()).toBeNull();
    expect(await AsyncStorage.getItem(PENDING_CONSENT_KEY)).toBeNull();
  });
});
