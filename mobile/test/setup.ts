/* The fake API is installed per test by the tests that need it; this only checks and tears it down. */
afterEach(() => {
  const installed = (globalThis as Record<string, unknown>).__vehiclePassportFakeApi as
    | { violations: string[]; uninstall(): void }
    | undefined;
  if (!installed) return;
  const violations = [...installed.violations];
  installed.uninstall();
  if (violations.length > 0) {
    throw new Error(`The app broke the API contract:\n${violations.map((v) => `  - ${v}`).join('\n')}`);
  }
});
export {};
