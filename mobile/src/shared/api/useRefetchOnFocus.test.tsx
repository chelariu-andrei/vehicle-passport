import { render } from '@testing-library/react-native';

import { useRefetchOnFocus } from './useRefetchOnFocus';

/* Mirrors the real hook's contract: the effect runs on focus and again whenever the callback identity changes. */
let focusCallback: (() => void) | undefined;
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (cb: () => void) => {
      focusCallback = cb;
      useEffect(() => cb(), [cb]);
    },
  };
});

function Probe({ refetch }: { refetch: () => void }) {
  useRefetchOnFocus(refetch);
  return null;
}

test('refetches on each focus after the first', async () => {
  const refetch = jest.fn();
  await render(<Probe refetch={refetch} />);
  expect(refetch).not.toHaveBeenCalled();
  focusCallback?.();
  expect(refetch).toHaveBeenCalledTimes(1);
});

test('re-rendering with a new function identity does not refetch', async () => {
  const calls = jest.fn();
  const screen = await render(<Probe refetch={() => calls()} />);
  await screen.rerender(<Probe refetch={() => calls()} />);
  await screen.rerender(<Probe refetch={() => calls()} />);
  expect(calls).not.toHaveBeenCalled();
});

test('a focus after re-renders calls the latest function', async () => {
  const first = jest.fn();
  const second = jest.fn();
  const screen = await render(<Probe refetch={first} />);
  await screen.rerender(<Probe refetch={second} />);
  focusCallback?.();
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});
