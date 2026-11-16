/* The app lock: whether it is on, how soon it closes, and the biometric / passcode check that opens it. */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import { en } from '@/shared/i18n/en';

export type LockTimeout = 'immediately' | '1m' | '5m';
export const LOCK_TIMEOUTS: readonly LockTimeout[] = ['immediately', '1m', '5m'];

export interface AppLockSettings {
  enabled: boolean;
  timeout: LockTimeout;
  /** Reserved for locking the wallet separately; nothing sets it yet. */
  walletLocked: boolean;
}

export interface AppLockState extends AppLockSettings {
  /** The biometric offer was shown and answered (either way), so it is never made again. */
  offered: boolean;
  /** The saved settings have been read. */
  loaded: boolean;
  /** The app is covered by the lock screen now (in memory only). */
  locked: boolean;
}

const STORAGE_KEY = 'appLock';
const TIMEOUT_MS: Record<LockTimeout, number> = { immediately: 0, '1m': 60_000, '5m': 5 * 60_000 };

/** Whether coming back to the app should ask for the lock. `null`: the app was never left. */
export function shouldLock(lastBackgroundedAt: number | null, now: number, timeout: LockTimeout): boolean {
  if (lastBackgroundedAt === null) return false;
  if (timeout === 'immediately') return true;
  return now - lastBackgroundedAt >= TIMEOUT_MS[timeout];
}

const DEFAULTS = { enabled: false, timeout: '1m', walletLocked: false, offered: false } as const satisfies Omit<AppLockState, 'loaded' | 'locked'>;
type Persisted = Pick<AppLockState, 'enabled' | 'timeout' | 'walletLocked' | 'offered'>;

let state: AppLockState = { ...DEFAULTS, loaded: false, locked: false };
let hydration: Promise<void> | null = null;
const subscribers = new Set<() => void>();

function publish(next: AppLockState): void {
  state = next;
  subscribers.forEach((notify) => notify());
}

const isTimeout = (value: unknown): value is LockTimeout => LOCK_TIMEOUTS.includes(value as LockTimeout);

function parse(raw: string | null): Persisted {
  if (!raw) return { ...DEFAULTS };
  try {
    const value = JSON.parse(raw) as Partial<Persisted>;
    return {
      enabled: value.enabled === true,
      timeout: isTimeout(value.timeout) ? value.timeout : DEFAULTS.timeout,
      walletLocked: value.walletLocked === true,
      offered: value.offered === true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

async function persist(): Promise<void> {
  const { enabled, timeout, walletLocked, offered } = state;
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ enabled, timeout, walletLocked, offered }));
  } catch (error) {
    console.warn('The app lock settings could not be saved', error);
  }
}

/** Reads the saved settings once. A cold start with the lock on starts locked. */
function hydrate(): Promise<void> {
  hydration ??= (async () => {
    let saved: Persisted = { ...DEFAULTS };
    try {
      saved = parse(await SecureStore.getItemAsync(STORAGE_KEY));
    } catch (error) {
      console.warn('The app lock settings could not be read', error);
    }
    publish({ ...state, ...saved, loaded: true, locked: saved.enabled });
  })();
  return hydration;
}

export const appLock = {
  get: (): AppLockState => state,
  hydrate,
  async update(patch: Partial<AppLockSettings> & { offered?: boolean }): Promise<void> {
    await hydrate();
    publish({ ...state, ...patch, locked: patch.enabled === false ? false : state.locked });
    await persist();
  },
  setLocked(locked: boolean): void {
    if (state.locked !== locked) publish({ ...state, locked });
  },
};

/** The lock state, and the settings once they have been read from the phone. */
export function useAppLock(): AppLockState {
  const current = useSyncExternalStore(
    (notify) => {
      subscribers.add(notify);
      void hydrate();
      return () => void subscribers.delete(notify);
    },
    () => state,
  );
  return current;
}

/** A clean start for a test: defaults (and what `initial` says), nothing saved, settings counted as read. */
export async function resetAppLockForTests(initial: Partial<AppLockState> = {}): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {
    /* nothing saved */
  }
  hydration = Promise.resolve();
  publish({ ...DEFAULTS, loaded: true, locked: false, ...initial });
}

/** The app is started again on the same phone: memory is forgotten, what was saved is read back. */
export async function reloadAppLockForTests(): Promise<void> {
  hydration = null;
  publish({ ...DEFAULTS, loaded: false, locked: false });
  await hydrate();
}

export type Capability = 'available' | 'no-hardware' | 'not-enrolled' | 'unknown';

/** Whether this phone can check a fingerprint or face. 'unknown' when the system could not be asked: that is never taken as "no sensor". */
export async function biometricCapability(): Promise<Capability> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) return 'no-hardware';
    return (await LocalAuthentication.isEnrolledAsync()) ? 'available' : 'not-enrolled';
  } catch {
    return 'unknown';
  }
}

let checking = false;
let checkedAt = 0;
/** The system's check is open, or has just closed (iOS reports the app active a moment after): that is not the person leaving the app. */
export const checkingIdentity = (): boolean => checking || Date.now() - checkedAt < 1000;

/** Asks for Face ID or a fingerprint, falling back to the device passcode. Resolves false when it fails or is dismissed. */
export async function authenticate(promptMessage: string = en.security.promptMessage): Promise<boolean> {
  checking = true;
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, disableDeviceFallback: false });
    return result.success;
  } catch {
    return false;
  } finally {
    checking = false;
    checkedAt = Date.now();
  }
}
