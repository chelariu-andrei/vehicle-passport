import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';

import { ThemeProvider, useTheme } from './theme';
import { tokens } from './tokens.generated';

function Probe() {
  const { scheme, preference, colors, setPreference } = useTheme();
  return (
    <>
      <RNText testID="out">{`${scheme}|${preference}|${colors.bg}`}</RNText>
      <RNText onPress={() => setPreference('light')}>go-light</RNText>
    </>
  );
}

describe('theme', () => {
  beforeEach(() => AsyncStorage.clear());

  it('follows the system scheme by default', async () => {
    await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('out').props.children).toMatch(/^(light|dark)\|system\|/));
  });

  it('persists a chosen preference under "appearance"', async () => {
    await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await act(async () => screen.getByText('go-light').props.onPress());
    expect(screen.getByTestId('out').props.children).toBe(`light|light|${tokens.color.light.bg}`);
    expect(await AsyncStorage.getItem('appearance')).toBe('light');
  });

  it('restores a stored preference', async () => {
    await AsyncStorage.setItem('appearance', 'dark');
    await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('out').props.children).toBe(`dark|dark|${tokens.color.dark.bg}`));
  });
});
