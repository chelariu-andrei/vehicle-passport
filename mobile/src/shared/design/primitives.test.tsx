import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AsyncList, Button, ConfirmSheet, EvidenceBadge, Field, toast, ToastHost } from '.';

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
      <ConfirmSheet visible title="Delete?" body="Cannot be undone" confirmLabel="Delete" danger onConfirm={onConfirm} onCancel={onCancel} />,
    );
    expect(screen.getByText('Cannot be undone')).toBeTruthy();
    await fireEvent.press(screen.getByText('Delete'));
    await fireEvent.press(screen.getByText('Cancel'));
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
    await render(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 34 } }}
      >
        <ToastHost />
      </SafeAreaProvider>,
    );
    await act(async () => toast('Saved'));
    expect(screen.getByText('Saved')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('Saved')).toBeNull();
    jest.useRealTimers();
  });
});
