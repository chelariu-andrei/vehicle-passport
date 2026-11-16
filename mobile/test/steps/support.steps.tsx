import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { onlineManager } from '@tanstack/react-query';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { en } from '@/shared/i18n/en';

import { openApp } from '../harness';
import type { FakeApi } from '../fake-api';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/support.feature', { loadRelativePath: true });

const inertTabs = { '(tabs)/index': () => null, '(tabs)/scans': () => null, '(tabs)/passports': () => null };
const LONG = 'The scanner keeps failing on my invoices';

afterEach(() => onlineManager.setOnline(true));

async function send(message: string, diagnostics?: boolean) {
  await fireEvent.changeText(screen.getByLabelText(en.support.message), message);
  if (diagnostics === true) await fireEvent(screen.getByRole('switch', { name: en.support.diagnostics }), 'valueChange', true);
  await fireEvent.press(screen.getByRole('button', { name: en.support.send }));
}

defineFeature(feature, (test) => {
  let fake: FakeApi;
  const writing = (given: (text: string, fn: () => Promise<void>) => void) =>
    given('I am writing to support', async () => {
      fake = await openApp('/account/support', { routes: inertTabs });
      await screen.findByText(en.support.title);
    });

  test('Report under 10 characters shows an error', ({ given, when, then, and }) => {
    writing(given);
    when('I send the report "too short"', () => send('too short'));
    then('I see the message is too short', async () => {
      expect(await screen.findByText(en.validation.supportMessageTooShort)).toBeTruthy();
    });
    and('nothing was sent', () => {
      expect(fake.callsTo('createSupportReport')).toHaveLength(0);
    });
  });

  test('Diagnostics switch off sends no diagnostics', ({ given, when, then }) => {
    writing(given);
    when('I send the report "The scanner keeps failing on my invoices" with diagnostics off', () => send(LONG));
    then('the report was sent without diagnostics', async () => {
      await waitFor(() => expect(fake.callsTo('createSupportReport')).toHaveLength(1));
      const body = fake.callsTo('createSupportReport')[0].body as Record<string, unknown>;
      expect(body.includeDiagnostics).toBe(false);
      expect(body.diagnostics).toBeUndefined();
      expect(body.message).toBe(LONG);
    });
  });

  test('Diagnostics switch on sends the listed fields', ({ given, when, then }) => {
    writing(given);
    when('I send the report "The scanner keeps failing on my invoices" with diagnostics on', () => send(LONG, true));
    then('the report was sent with the app version, platform, system version and device model', async () => {
      await waitFor(() => expect(fake.callsTo('createSupportReport')).toHaveLength(1));
      const body = fake.callsTo('createSupportReport')[0].body as { includeDiagnostics: boolean; diagnostics: Record<string, unknown> };
      expect(body.includeDiagnostics).toBe(true);
      expect(Object.keys(body.diagnostics).sort()).toEqual(['appVersion', 'deviceModel', 'osVersion', 'platform']);
      for (const value of Object.values(body.diagnostics)) expect(typeof value).toBe('string');
    });
  });

  test('Successful report shows confirmation and clears the form', ({ given, when, then, and }) => {
    writing(given);
    when('I send the report "The scanner keeps failing on my invoices" with diagnostics off', () => send(LONG));
    then('I see the report was sent', async () => {
      expect(await screen.findByText(en.support.sent)).toBeTruthy();
    });
    and('the message field is empty', () => {
      expect(screen.getByLabelText(en.support.message).props.value).toBe('');
    });
  });

  test('Offline keeps the draft', ({ given, when, then, and }) => {
    writing(given);
    and('the server cannot be reached', async () => {
      await act(async () => onlineManager.setOnline(false));
    });
    when('I send the report "The scanner keeps failing on my invoices" with diagnostics off', () => send(LONG));
    then('I see the report could not be sent', async () => {
      expect(await screen.findByText(en.support.offline)).toBeTruthy();
      expect(fake.callsTo('createSupportReport')).toHaveLength(0);
    });
    and('the message field still holds my draft', () => {
      expect(screen.getByLabelText(en.support.message).props.value).toBe(LONG);
    });
    and('sending again after the connection returns works', async () => {
      await act(async () => onlineManager.setOnline(true));
      await fireEvent.press(screen.getByRole('button', { name: en.support.send }));
      expect(await screen.findByText(en.support.sent)).toBeTruthy();
      expect(fake.callsTo('createSupportReport')).toHaveLength(1);
    });
  });

  test('Acknowledgements list includes expo-router', ({ when, then, and }) => {
    when('I open the acknowledgements', async () => {
      await openApp('/account/acknowledgements', { routes: inertTabs });
    });
    then('I see expo-router in the list', async () => {
      // The list holds hundreds of packages and is virtualised, so it is searched by name.
      await fireEvent.changeText(await screen.findByLabelText(en.acknowledgements.search), 'expo-router');
      expect(await screen.findByRole('button', { name: /^expo-router / })).toBeTruthy();
    });
    and('tapping it shows its licence text', async () => {
      await fireEvent.press(screen.getByRole('button', { name: /^expo-router / }));
      expect(await screen.findByText(/Permission is hereby granted/)).toBeTruthy();
      expect(screen.getByText(en.acknowledgements.generatedNote('MIT'))).toBeTruthy();
    });
  });
});
