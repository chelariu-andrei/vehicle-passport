import { render } from '@testing-library/react-native';

import { useRefetchOnFocus } from './useRefetchOnFocus';

let focusCallback: (() => void) | undefined;
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    focusCallback = cb;
  },
}));

function Probe({ refetch }: { refetch: () => void }) {
  useRefetchOnFocus(refetch);
  return null;
}

test('refetches on each focus after the first', async () => {
  const refetch = jest.fn();
  await render(<Probe refetch={refetch} />);
  focusCallback?.();
  expect(refetch).not.toHaveBeenCalled();
  focusCallback?.();
  expect(refetch).toHaveBeenCalledTimes(1);
});
