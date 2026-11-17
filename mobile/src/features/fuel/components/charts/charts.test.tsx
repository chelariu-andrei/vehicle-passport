import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/shared/design';

import { BarChart } from './BarChart';
import { LineChart } from './LineChart';

const wrap = (node: React.ReactElement) => render(<ThemeProvider>{node}</ThemeProvider>);
const points = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ x: i * 86_400_000, y: 6 + i / 10, label: `p${i}`, flagged: i === n - 1 }));

describe('LineChart', () => {
  test.each([0, 1, 5])('renders with %i points and carries the summary label', async (n) => {
    await wrap(<LineChart series={points(n)} ariaSummary="Consumption, average 6.9" />);
    expect(screen.getByLabelText('Consumption, average 6.9')).toBeTruthy();
  });
});

describe('BarChart', () => {
  test.each([0, 1, 6])('renders with %i bars and carries the summary label', async (n) => {
    const bars = Array.from({ length: n }, (_, i) => ({ label: `${i}`, value: 100 + i, partial: i === n - 1 }));
    await wrap(<BarChart bars={bars} ariaSummary="Cost per month" />);
    expect(screen.getByLabelText('Cost per month')).toBeTruthy();
  });
});
