import { act, renderHook } from '@testing-library/react-native';

import { startSession } from '@/shared/auth/session';

import { fakeAuth } from '../../../../test/fakes/auth';
import { lockedEvents, useIsLocked } from './lockedEvents';

afterEach(() => lockedEvents.clear());

test('a locked event reads as locked, others do not', async () => {
  const { result } = await renderHook(() => [useIsLocked('a'), useIsLocked('b')]);
  expect(result.current).toEqual([false, false]);
  await act(async () => lockedEvents.lock('a'));
  expect(result.current).toEqual([true, false]);
});

test('the lock ends with the session', async () => {
  const stop = startSession();
  await act(async () => undefined);
  lockedEvents.lock('a');
  await act(async () => fakeAuth.port.signOutLocal());
  expect(lockedEvents.has('a')).toBe(false);
  stop();
});
