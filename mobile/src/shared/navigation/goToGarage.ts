import { router } from 'expo-router';

/**
 * Returns to the garage with nothing left to go back to. A plain `replace` swaps only the top screen, so a car's
 * detail screen would stay mounted under its claims screen and Back would reveal a car that is no longer ours.
 */
export function goToGarage(): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
}
