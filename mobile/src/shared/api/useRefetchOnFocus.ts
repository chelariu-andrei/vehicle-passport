import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Refetches each time the screen regains focus. The first focus is skipped: the mount fetch covers it.
 * `refetch` lives in a ref so a new function identity each render does not re-run the focus effect.
 */
export function useRefetchOnFocus(refetch: () => unknown): void {
  const latest = useRef(refetch);
  useEffect(() => {
    latest.current = refetch;
  });
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void latest.current();
    }, []),
  );
}
