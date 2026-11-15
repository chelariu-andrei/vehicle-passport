import { router } from 'expo-router';

/**
 * Returns to the Car tab with nothing left to go back to. A plain `replace` swaps only the top screen, so a car's
 * screen (claims, edit) would stay mounted under it and Back would reveal a car that is no longer ours. The tab then
 * shows whichever car is active once the departed one is forgotten.
 */
export function goToGarage(): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
}
