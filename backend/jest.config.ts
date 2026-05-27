import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/',
    '^@features/(.*)$': '<rootDir>/src/features/',
    '^@shared/(.*)$': '<rootDir>/src/shared/',
    '^@core/(.*)$': '<rootDir>/src/core/',
    '^@config/(.*)$': '<rootDir>/src/config/',
  },
  testMatch: ['**/*.spec.ts'],
};

export default config;
