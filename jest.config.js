module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testPathIgnorePatterns: ['/node_modules/', '__mocks__'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '_cors\\.js$': '<rootDir>/__tests__/__mocks__/_cors.ts',
    '^(\\.\\.[\\/])*services[\\/]supabaseServer$': '<rootDir>/__tests__/__mocks__/supabaseServer.ts',
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
      lines: 20,
      branches: 15,
      functions: 15,
      statements: 20,
    },
  },
};
