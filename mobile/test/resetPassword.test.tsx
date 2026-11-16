import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { en } from '@/shared/i18n/en';

import { fakeAuth, RECOVERY_CODE } from './fakes/auth';
import { openApp } from './harness';

test('the reset link starts a recovery, and the new password is saved', async () => {
  await openApp(`/reset-password?code=${RECOVERY_CODE}`, { as: null });
  await fireEvent.changeText(await screen.findByLabelText(en.auth.newPassword), 'a-brand-new-password');
  await fireEvent.press(screen.getByRole('button', { name: en.auth.resetAction }));
  await waitFor(() => expect(fakeAuth.passwords).toEqual(['a-brand-new-password']));
  await waitFor(() => expect(screen).toHavePathname('/'));
});

test('a short new password is refused under the field', async () => {
  await openApp(`/reset-password?code=${RECOVERY_CODE}`, { as: null });
  await fireEvent.changeText(await screen.findByLabelText(en.auth.newPassword), 'short');
  await fireEvent.press(screen.getByRole('button', { name: en.auth.resetAction }));
  expect(await screen.findByText(en.validation.passwordTooShort)).toBeTruthy();
  expect(fakeAuth.passwords).toEqual([]);
});

test('an expired link offers a new one', async () => {
  await openApp('/reset-password?code=stale', { as: null });
  expect(await screen.findByText(en.auth.resetLinkInvalid)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: en.auth.toForgot }));
  await waitFor(() => expect(screen).toHavePathname('/forgot-password'));
});
