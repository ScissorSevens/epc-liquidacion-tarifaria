import type { Config } from 'jest';

// Config de jest del root: SOLO tests del backend TS (src/).
// Los tests mobile (preset jest-expo, deps RN/Expo) se ejecutan via
// `npm test --workspace=mobile` con su propio jest-expo en `mobile/`.
// Mezclar ambos en un mismo jest --coverage rompe el typecheck porque
// el preset ts-jest del root no entiende los imports expo-sqlite, etc.
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  collectCoverageFrom: ['<rootDir>/src/**/*.ts', '!<rootDir>/src/**/*.test.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  moduleNameMapper: {
    '^@dominio/(.*)$': '<rootDir>/src/$1',
  },
  verbose: true,
};

export default config;
