/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
};

process.env.JEST_JUNIT_OUTPUT_DIR =
  process.env.JEST_JUNIT_OUTPUT_DIR ?? './reports';
process.env.JEST_JUNIT_OUTPUT_NAME =
  process.env.JEST_JUNIT_OUTPUT_NAME ?? 'junit.xml';
