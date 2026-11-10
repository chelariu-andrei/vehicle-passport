module.exports = {
  preset: 'jest-expo',
  // The router-driven suites pass in a second alone but can exceed the 5 s default when all run in parallel.
  testTimeout: 20000,
  setupFiles: ['<rootDir>/test/fakes/nativeModules.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testMatch: ['**/test/**/*.steps.tsx', '**/test/**/*.test.ts?(x)', '**/src/**/*.test.ts?(x)'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
