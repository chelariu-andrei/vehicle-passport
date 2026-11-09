module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/test/fakes/nativeModules.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testMatch: ['**/test/**/*.steps.tsx', '**/test/**/*.test.ts?(x)', '**/src/**/*.test.ts?(x)'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
