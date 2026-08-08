import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
  },
  testMatch: ['**/*.spec.ts'],
  // Mỗi bộ test HTTP tự dựng một MongoDB replica set trong bộ nhớ. Chạy full
  // song song làm worker chết vì hết tài nguyên (bộ test "failed to run" ngẫu
  // nhiên), nên giới hạn số worker để kết quả ổn định.
  maxWorkers: 2,
};

export default config;
