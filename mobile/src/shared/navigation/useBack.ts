import { router, type Href } from 'expo-router';
import { useCallback } from 'react';

/** Goes back when there is a screen to go back to, otherwise replaces the current screen with `fallback`. */
export function useBack(fallback: Href): () => void {
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [fallback]);
}
