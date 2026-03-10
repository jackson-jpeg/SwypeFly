module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testPathIgnorePatterns: ['/node_modules/', '__mocks__'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '_cors\\.js$': '<rootDir>/__tests__/__mocks__/_cors.ts',
  },
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
      lines: 45,
      branches: 33,
      functions: 35,
      statements: 44,
    },
  },
};
