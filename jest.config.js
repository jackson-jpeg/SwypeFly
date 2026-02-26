module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'api/**/*.ts',
    'utils/**/*.ts',
    '!utils/sentry.ts',
    '!utils/webVitals.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      lines: 50,
      branches: 40,
      functions: 40,
      statements: 50,
    },
  },
};
