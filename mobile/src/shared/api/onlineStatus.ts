import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

/** Points TanStack's focus and online signals at AppState and NetInfo. Safe to call repeatedly. */
export function registerOnlineStatus(): void {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (state) => handleFocus(state === 'active'));
    return () => subscription.remove();
  });
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false)),
  );
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
    () => true,
  );
}
