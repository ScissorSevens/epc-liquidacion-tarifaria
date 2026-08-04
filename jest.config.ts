import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/mobile/__tests__/**/*.test.ts',
    '<rootDir>/mobile/dominio/**/__tests__/**/*.test.ts',
  ],
  // Tests de UI en mobile/__tests__/hooks/ que cargan @testing-library/react-native
  // (el cual importa react-native con sintaxis Flow que ts-jest root no transforma).
  // Estos tests corren correctamente desde mobile/jest (preset jest-expo).
  testPathIgnorePatterns: ['<rootDir>/mobile/__tests__/hooks/'],
  collectCoverageFrom: ['<rootDir>/src/**/*.ts', '!<rootDir>/src/**/*.test.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  // Excluimos node_modules de mobile/ para que jest del root no intente
  // resolver dependencias de RN/Expo que no estan instaladas en el root.
  modulePathIgnorePatterns: ['<rootDir>/mobile/node_modules/'],
  moduleNameMapper: {
    '^@dominio/(.*)$': '<rootDir>/src/$1',
  },
  verbose: true,
};

export default config;
