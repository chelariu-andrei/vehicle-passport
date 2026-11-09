import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/** Refetches each time the screen regains focus. The first focus is skipped: the mount fetch covers it. */
export function useRefetchOnFocus(refetch: () => unknown): void {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );
}
