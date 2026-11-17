import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { CountBadge, StatusPill } from '.';
import { iconNames } from './primitives/Icon';
import { tokens } from './tokens.generated';

const dark = tokens.color.dark;
const styleOf = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

describe('Icon bundle', () => {
  it('has a bell', () => {
    expect(iconNames).toContain('bell');
  });
});

describe('StatusPill', () => {
  it.each([
    ['ok', dark.brand],
    ['warn', dark.warning],
    ['bad', dark.danger],
    ['muted', dark['evidence-estimated']],
  ] as const)('tone %s draws its border in the matching colour', async (tone, color) => {
    await render(<StatusPill tone={tone} label="Word" testID="pill" />);
    expect(styleOf('pill').borderColor).toBe(color);
    expect(screen.getByText('Word')).toBeTruthy();
  });

  it('dashed draws a dashed border, the default is solid', async () => {
    await render(<StatusPill tone="muted" label="Not added" dashed testID="dashed" />);
    expect(styleOf('dashed').borderStyle).toBe('dashed');
    await render(<StatusPill tone="ok" label="Valid" testID="solid" />);
    expect(styleOf('solid').borderStyle).toBe('solid');
  });

  it('reads as one element with the word as its label', async () => {
    await render(<StatusPill tone="bad" label="Expired" icon="alert" />);
    expect(screen.getByLabelText('Expired')).toBeTruthy();
  });
});

describe('CountBadge', () => {
  it('renders nothing at 0', async () => {
    await render(<CountBadge count={0} tone="warn" testID="badge" />);
    expect(screen.queryByTestId('badge')).toBeNull();
  });

  it('shows the count', async () => {
    await render(<CountBadge count={3} tone="warn" testID="badge" />);
    expect(screen.getByText('3')).toBeTruthy();
    expect(styleOf('badge').backgroundColor).toBe(dark.warning);
  });

  it('shows 9+ above nine', async () => {
    await render(<CountBadge count={10} tone="bad" testID="badge" />);
    expect(screen.getByText('9+')).toBeTruthy();
    expect(styleOf('badge').backgroundColor).toBe(dark.danger);
  });

  it('is at least 18 by 18', async () => {
    await render(<CountBadge count={1} tone="warn" testID="badge" />);
    const style = styleOf('badge');
    expect(style.minWidth).toBeGreaterThanOrEqual(18);
    expect(style.minHeight).toBeGreaterThanOrEqual(18);
  });
});
