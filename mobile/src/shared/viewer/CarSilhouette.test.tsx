import { render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import { en } from '@/shared/i18n/en';

import { CarSilhouette } from './CarSilhouette';
import { BODY_TYPES, NEUTRAL_LOOK, paintHex, type Look } from './look';

type Json = ReturnType<typeof screen.toJSON>;
function collect(node: Json | string, type: string): { props: Record<string, unknown> }[] {
  if (!node || typeof node === 'string') return [];
  if (Array.isArray(node)) return node.flatMap((child) => collect(child, type));
  return [...(node.type === type ? [node] : []), ...(node.children ?? []).flatMap((child) => collect(child, type))];
}

test.each(BODY_TYPES)('%s is labelled from en.ts', async (bodyType) => {
  await render(<CarSilhouette look={{ ...NEUTRAL_LOOK, bodyType }} width={200} />);
  expect(screen.getByLabelText(en.look.body[bodyType])).toBeTruthy();
});

test('the body path is filled with the paint', async () => {
  const look: Look = { ...NEUTRAL_LOOK, bodyType: 'SUV', color: 'RED' };
  await render(<CarSilhouette look={look} width={200} />);
  const paths = collect(screen.toJSON(), 'RNSVGPath');
  const expected = processColor(paintHex(look));
  expect(paths[0].props.fill).toEqual({ type: 0, payload: expected });
});
