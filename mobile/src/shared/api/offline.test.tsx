import { onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';

import { en } from '../i18n/en';
import { OfflineBanner } from '../design/primitives/OfflineBanner';
import { ThemeProvider } from '../design';

afterEach(() => onlineManager.setOnline(true));

test('the offline banner appears only while offline', async () => {
  await render(
    <ThemeProvider>
      <OfflineBanner />
    </ThemeProvider>,
  );
  expect(screen.queryByText(en.errors.offlineBanner)).toBeNull();
  await act(async () => onlineManager.setOnline(false));
  expect(screen.getByText("You're offline. Showing saved data.")).toBeTruthy();
  await act(async () => onlineManager.setOnline(true));
  expect(screen.queryByText(en.errors.offlineBanner)).toBeNull();
});
