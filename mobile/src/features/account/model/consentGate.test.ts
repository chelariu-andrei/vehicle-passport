import { aMeFor } from './consentGate.fixtures';
import { resolveGate } from './consentGate';

describe('resolveGate', () => {
  const pendingFlag = { termsAccepted: true };

  it('waits while the stored sign-up acceptance is being read', () => {
    expect(resolveGate({ data: aMeFor(false), isError: false }, undefined)).toBe('loading');
  });
  it('waits for the account, and reports a failure to load it', () => {
    expect(resolveGate({ isError: false }, null)).toBe('loading');
    expect(resolveGate({ isError: true }, null)).toBe('error');
  });
  it('opens only when nothing is owed', () => {
    expect(resolveGate({ data: aMeFor(false), isError: false }, null)).toBe('open');
    expect(resolveGate({ data: aMeFor(true), isError: false }, null)).toBe('consent');
  });
  it('keeps the last known answer when a refetch fails', () => {
    expect(resolveGate({ data: aMeFor(true), isError: true }, null)).toBe('consent');
  });
  it('does not flash the gate while the sign-up acceptance is being recorded', () => {
    expect(resolveGate({ data: aMeFor(true), isError: false }, pendingFlag)).toBe('loading');
  });
});
