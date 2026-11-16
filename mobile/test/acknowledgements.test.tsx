/* A notice whose copyright holder the package does not declare says so on screen. */
import { fireEvent, screen } from 'expo-router/testing-library';

import { packages } from '@/features/support/model/licenses';
import { en } from '@/shared/i18n/en';

import { openApp } from './harness';

const inertTabs = { '(tabs)/index': () => null, '(tabs)/scans': () => null, '(tabs)/passports': () => null };

async function open(name: string) {
  await openApp('/account/acknowledgements', { routes: inertTabs });
  await fireEvent.changeText(await screen.findByLabelText(en.acknowledgements.search), name);
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^${name} `) }));
}

test('an inferred holder is flagged', async () => {
  const inferred = packages.find((pkg) => pkg.holderInferred);
  expect(inferred).toBeDefined();
  await open(inferred!.name);
  expect(await screen.findByText(en.acknowledgements.holderNote)).toBeTruthy();
});

test('a declared holder is not flagged', async () => {
  await open('expo-router');
  expect(await screen.findByText(en.acknowledgements.generatedNote('MIT'))).toBeTruthy();
  expect(screen.queryByText(en.acknowledgements.holderNote)).toBeNull();
});
