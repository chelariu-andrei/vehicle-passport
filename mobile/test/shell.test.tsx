import { renderRouter, screen } from 'expo-router/testing-library';

test('the app opens on the garage route', async () => {
  await renderRouter('./app', { initialUrl: '/' });
  expect(screen).toHavePathname('/');
});
