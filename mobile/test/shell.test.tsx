import { renderRouter, screen } from 'expo-router/testing-library';

test('the app opens on the garage route', async () => {
  await renderRouter('./app', { initialUrl: '/' });
  expect(screen).toHavePathname('/');
});

test.each([
  ['/scans', 'Scans'],
  ['/passports', 'Passports'],
  ['/account', 'Account'],
])('the %s tab renders its screen', async (path, title) => {
  await renderRouter('./app', { initialUrl: path });
  expect(screen).toHavePathname(path);
  expect(screen.getAllByText(title).length).toBeGreaterThan(0);
});
