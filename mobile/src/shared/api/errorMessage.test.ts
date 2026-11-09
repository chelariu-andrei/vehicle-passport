import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { en } from '../i18n/en';
import { ApiError, isApiError, unwrap } from './apiError';
import { errorMessage } from './errorMessage';

const GENERIC = 'Something went wrong. Try again.';

afterEach(() => jest.restoreAllMocks());

test('maps quoted copy from integration section 4', () => {
  expect(errorMessage(new ApiError(409, 'already-owner'))).toBe('This car is already in your garage.');
  expect(errorMessage(new ApiError(403, 'document-restricted'))).toBe('This invoice stays private to the previous owner.');
  expect(errorMessage(new ApiError(404, 'vehicle-not-found'))).toBe('This car is no longer in your garage.');
});

test('an unknown code is generic and is logged', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  expect(errorMessage(new ApiError(500, 'brand-new-code'))).toBe(GENERIC);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('brand-new-code'));
});

test('a non-API error reads as a network failure', () => {
  expect(errorMessage(new TypeError('Network request failed'))).toBe(en.errors.network);
  expect(en.errors.network).toBe("You're offline. Try again when you're connected.");
});

// Ruling R5: codes with no quoted copy are behaviours, not messages.
const BEHAVIOUR_ONLY = ['invalid-cursor', 'scan-not-found', 'scan-state-conflict', 'batch-too-large', 'passport-not-found'];

test('every code in integration section 4 has a catalog message, except the behaviour-only ones', () => {
  const spec = readFileSync(resolve(__dirname, '../../../../docs/superpowers/specs/2026-11-09-mobile-api-integration.md'), 'utf8');
  const section = spec.split('## 4. Error copy')[1].split('## 5.')[0];
  const codes = section
    .split('\n')
    .filter((line) => line.startsWith('| `') && !line.startsWith('| `code`'))
    .flatMap((line) => [...line.split('|')[1].matchAll(/`([a-z-]+)`/g)].map((m) => m[1]));
  expect(codes.length).toBeGreaterThan(15);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  for (const code of codes) {
    const message = errorMessage(new ApiError(400, code));
    if (BEHAVIOUR_ONLY.includes(code)) expect([code, message]).toEqual([code, GENERIC]);
    else expect([code, message === GENERIC]).toEqual([code, false]);
  }
  expect(warn).not.toHaveBeenCalled();
});

test('a cell naming two codes gives both the same message', () => {
  expect(errorMessage(new ApiError(404, 'claim-not-found'))).toBe('That claim was already decided.');
  expect(errorMessage(new ApiError(409, 'claim-not-pending'))).toBe('That claim was already decided.');
});

test('unwrap throws an ApiError carrying status and code, and returns data otherwise', () => {
  const response = new Response('{}', { status: 409 });
  let thrown: unknown;
  try {
    unwrap({ error: { code: 'already-owner', detail: 'ignored' }, response });
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(ApiError);
  expect(isApiError(thrown, 'already-owner')).toBe(true);
  expect(isApiError(thrown, 'other')).toBe(false);
  expect(unwrap({ data: { a: 1 }, response: new Response('{}', { status: 200 }) })).toEqual({ a: 1 });
  expect(() => unwrap({ error: '', response: new Response(null, { status: 500 }) })).toThrow(ApiError);
});
