/* Every user-visible string. Later tasks add their own sections. */
export const en = {
  tabs: {
    garage: 'Garage',
    scans: 'Scans',
    passports: 'Passports',
    account: 'Account',
  },
  common: {
    cancel: 'Cancel',
    retry: 'Try again',
    loading: 'Loading',
    errorTitle: 'Something went wrong',
    errorBody: 'Check your connection and try again.',
  },
  viewer: {
    devTitle: '3D viewer check',
    fps: (value: number | null) => (value === null ? 'FPS: waiting' : `FPS: ${value}`),
    colourButton: (name: string) => `Colour: ${name}`,
  },
  evidence: {
    ESTIMATED: 'Estimated',
    USER_CONFIRMED: 'Confirmed',
    DOCUMENTED: 'Documented',
    VERIFIED: 'Verified',
    a11y: (word: string) => `Evidence: ${word.toLowerCase()}`,
  },
} as const;
