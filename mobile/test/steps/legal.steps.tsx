import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { en } from '@/shared/i18n/en';

import { openApp } from '../harness';
import type { FakeApi } from '../fake-api';

/* The scenario that needs another app language sets this; i18n itself arrives in a later task. */
let mockLocale = 'en';
jest.mock('@/features/legal/model/locale', () => ({ currentLocale: () => mockLocale }));

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/legal.feature', { loadRelativePath: true });

const inertTabs = { '(tabs)/index': () => null, '(tabs)/scans': () => null, '(tabs)/passports': () => null };

beforeEach(() => {
  mockLocale = 'en';
});

defineFeature(feature, (test) => {
  test('Terms open from the sign-up caption while signed out', ({ given, when, then }) => {
    given('I am signed out on the sign-up screen', async () => {
      await openApp('/sign-up', { as: null });
      await screen.findByText(en.auth.signUpTitle);
    });
    when('I tap Terms in the caption', async () => {
      await fireEvent.press(screen.getAllByText(en.auth.terms)[0]);
    });
    then('I read the terms without being sent to sign-in', async () => {
      expect(await screen.findByText('Your account')).toBeTruthy();
      expect(screen).toHavePathname('/legal/terms');
    });
  });

  test('Legal list shows version and effective date', ({ when, then }) => {
    when('I open the legal documents in Account', async () => {
      await openApp('/account/legal', { routes: inertTabs });
    });
    then('I see each document title, version and effective date', async () => {
      expect(await screen.findByText('Terms of Service')).toBeTruthy();
      expect(screen.getByText('Privacy Policy')).toBeTruthy();
      expect(screen.getByText('Data sharing')).toBeTruthy();
      expect(screen.getByText('Version 1.0 · effective 1 Jan 2026')).toBeTruthy();
      expect(screen.getByText('Version 1.0 · effective 15 Jan 2026')).toBeTruthy();
      expect(screen.getByText('Version 1.0 · effective 1 Feb 2026')).toBeTruthy();
    });
  });

  test('Document falls back to English when locale unsupported', ({ given, when, then }) => {
    let fake: FakeApi;
    given('the app language is Romanian and the terms exist only in English', () => {
      mockLocale = 'ro';
    });
    when('I open the terms', async () => {
      fake = await openApp('/account/legal/terms', { routes: inertTabs });
    });
    then('I read the English terms', async () => {
      expect(await screen.findByText('Your account')).toBeTruthy();
      expect(fake.callsTo('getLegalDocument')[0].path).toContain('locale=ro');
    });
  });

  test('Offline shows retry', ({ given, when, then }) => {
    let fake: FakeApi;
    given('the legal service cannot be reached', () => {});
    when('I open the legal documents in Account', async () => {
      fake = await openApp('/account/legal', { routes: inertTabs, seed: (api) => api.failNext('listLegalDocuments', 503, 'unavailable') });
    });
    then('I see a retry button that loads them', async () => {
      await fireEvent.press(await screen.findByRole('button', { name: en.common.retry }));
      await waitFor(() => expect(screen.getByText('Terms of Service')).toBeTruthy());
      expect(fake.callsTo('listLegalDocuments')).toHaveLength(2);
    });
  });
});
