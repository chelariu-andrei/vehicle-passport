type Input = {
  status: 'loading' | 'error' | 'empty' | 'ready';
  claimsLoaded: boolean;
  claimCount: number;
};

// Per launch, in memory: "Later" holds the journey back until the app is next opened or the session ends.
let dismissed = false;

export const autoJourney = {
  /** The journey opens by itself only for a loaded, empty garage with no claim on its way, and not after "Later". */
  shouldStart({ status, claimsLoaded, claimCount }: Input): boolean {
    return !dismissed && status === 'empty' && claimsLoaded && claimCount === 0;
  },

  dismiss(): void {
    dismissed = true;
  },

  reset(): void {
    dismissed = false;
  },
};
