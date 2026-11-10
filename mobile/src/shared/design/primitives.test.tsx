import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Text as RNText } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { en } from '@/shared/i18n/en';

import { ActionBar, AppBar, AsyncList, Button, ConfirmSheet, EvidenceBadge, Field, Ground, Screen, ThemeProvider, toast, ToastHost } from '.';

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

describe('EvidenceBadge', () => {
  it.each([
    ['ESTIMATED', 'Estimated'],
    ['USER_CONFIRMED', 'Confirmed'],
    ['DOCUMENTED', 'Documented'],
    ['VERIFIED', 'Verified'],
  ] as const)('%s reads as %s', async (level, word) => {
    await render(<EvidenceBadge evidence={level} />);
    expect(screen.getByText(word)).toBeTruthy();
    expect(screen.getByLabelText(`Evidence: ${word.toLowerCase()}`)).toBeTruthy();
  });
});

describe('Button', () => {
  it('is at least 48 tall', async () => {
    await render(<Button title="Save" onPress={jest.fn()} />);
    const style = screen.getByRole('button').props.style;
    expect([style].flat(Infinity).some((s) => s && s.minHeight >= 48)).toBe(true);
  });

  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button title="Save" onPress={onPress} />);
    await fireEvent.press(screen.getByText('Save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button title="Save" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByText('Save'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not call onPress while loading', async () => {
    const onPress = jest.fn();
    await render(<Button title="Save" onPress={onPress} loading />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Field', () => {
  it('shows its label and error text', async () => {
    await render(<Field label="Mileage" value="" onChangeText={jest.fn()} error="Enter a number" />);
    expect(screen.getByLabelText('Mileage')).toBeTruthy();
    expect(screen.getByText('Enter a number')).toBeTruthy();
  });
});

describe('ConfirmSheet', () => {
  it('confirms and cancels', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await render(
      <ConfirmSheet visible title="Delete?" body="Cannot be undone" confirmLabel="Delete" dismissLabel="Keep it" danger onConfirm={onConfirm} onCancel={onCancel} />,
    );
    expect(screen.getByText('Cannot be undone')).toBeTruthy();
    await fireEvent.press(screen.getByText('Delete'));
    await fireEvent.press(screen.getByText('Keep it'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('AsyncList', () => {
  const base = { keyExtractor: (i: string) => i, renderItem: ({ item }: { item: string }) => <RNText>{item}</RNText> };

  it('renders a skeleton while pending', async () => {
    const query = { isPending: true, isError: false, refetch: jest.fn() };
    await render(<AsyncList {...base} query={query} data={undefined} empty={<RNText>nothing</RNText>} />);
    expect(screen.getByLabelText('Loading')).toBeTruthy();
  });

  it('renders the empty node for an empty list', async () => {
    const query = { isPending: false, isError: false, refetch: jest.fn() };
    await render(<AsyncList {...base} query={query} data={[]} empty={<RNText>nothing</RNText>} />);
    expect(screen.getByText('nothing')).toBeTruthy();
  });

  it('renders items', async () => {
    const query = { isPending: false, isError: false, refetch: jest.fn() };
    await render(<AsyncList {...base} query={query} data={['a', 'b']} empty={<RNText>nothing</RNText>} />);
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
  });

  it('renders a retry that calls refetch on error', async () => {
    const refetch = jest.fn();
    const query = { isPending: false, isError: true, refetch };
    await render(<AsyncList {...base} query={query} data={undefined} empty={<RNText>nothing</RNText>} />);
    await fireEvent.press(screen.getByText('Try again'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('toast', () => {
  it('shows the message and then clears it', async () => {
    jest.useFakeTimers();
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    await render(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 34 } }}
      >
        <ToastHost />
      </SafeAreaProvider>,
    );
    await act(async () => toast('Saved'));
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Saved');
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('Saved')).toBeNull();
    jest.useRealTimers();
  });
});

describe('AppBar', () => {
  it('shows Back only when it can go back', async () => {
    const onBack = jest.fn();
    const { unmount } = await render(<AppBar onBack={onBack} title="Garage" />);
    await fireEvent.press(screen.getByRole('button', { name: en.common.back }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Garage')).toBeTruthy();
    await unmount();
    await render(<AppBar title="Garage" />);
    expect(screen.queryByRole('button', { name: en.common.back })).toBeNull();
  });
});

describe('ActionBar', () => {
  it('renders one primary and an optional quiet action', async () => {
    const primary = jest.fn();
    const quiet = jest.fn();
    await render(<ActionBar primary={{ title: 'Continue', onPress: primary }} quiet={{ title: 'Later', onPress: quiet }} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    await fireEvent.press(screen.getByText('Continue'));
    await fireEvent.press(screen.getByText('Later'));
    expect(primary).toHaveBeenCalledTimes(1);
    expect(quiet).toHaveBeenCalledTimes(1);
  });

  it('renders only the primary action without a quiet one', async () => {
    await render(<ActionBar primary={{ title: 'Continue', onPress: jest.fn() }} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('primary is disabled while loading', async () => {
    const onPress = jest.fn();
    await render(<ActionBar primary={{ title: 'Continue', onPress, loading: true }} />);
    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Screen', () => {
  it('renders its footer outside the scroll area', async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Screen scroll header={<RNText>head</RNText>} footer={<RNText>foot</RNText>}>
          <RNText>body</RNText>
        </Screen>
      </SafeAreaProvider>,
    );
    const scroll = screen.getByTestId('screen-scroll');
    expect(within(scroll).getByText('body')).toBeTruthy();
    expect(within(scroll).queryByText('foot')).toBeNull();
    expect(within(scroll).queryByText('head')).toBeNull();
    expect(screen.getByText('foot')).toBeTruthy();
  });
});

describe('Ground', () => {
  beforeEach(() => AsyncStorage.clear());

  it('draws grain in the dark theme', async () => {
    await AsyncStorage.setItem('appearance', 'dark');
    await render(
      <ThemeProvider>
        <Ground>
          <RNText>x</RNText>
        </Ground>
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('ground-grain')).toBeTruthy());
  });

  it('draws no grain in the light theme', async () => {
    await AsyncStorage.setItem('appearance', 'light');
    await render(
      <ThemeProvider>
        <Ground>
          <RNText>x</RNText>
        </Ground>
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.queryByTestId('ground-grain')).toBeNull());
    await act(async () => {});
    expect(screen.queryByTestId('ground-grain')).toBeNull();
  });
});
