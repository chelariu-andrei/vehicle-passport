import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { en } from '@/shared/i18n/en';

import { fakeAuth, PASSWORD } from './fakes/auth';
import { openApp } from './harness';

async function submitSignUp(email: string) {
  await openApp('/sign-up', { as: null });
  await fireEvent.changeText(await screen.findByLabelText(en.auth.email), email);
  await fireEvent.changeText(screen.getByLabelText(en.auth.password), PASSWORD);
  await fireEvent.press(screen.getByRole('button', { name: en.auth.signUpAction }));
}

test('a new account is signed in and taken to the garage', async () => {
  await submitSignUp('new@example.com');
  await waitFor(() => expect(screen).toHavePathname('/'));
  expect(fakeAuth.email).toBe('new@example.com');
});

test('a project that wants email confirmation returns no session, and the screen says so', async () => {
  fakeAuth.confirmationRequired = true;
  await submitSignUp('new@example.com');
  expect(await screen.findByText(en.auth.confirmationRequired)).toBeTruthy();
  expect(screen).toHavePathname('/sign-up');
});

test('an email that already has an account is explained', async () => {
  await submitSignUp('a@example.com');
  expect(await screen.findByText(en.auth.emailTaken)).toBeTruthy();
});
