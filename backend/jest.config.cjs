/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/tests'],
  testMatch: ['**/*.test.js'],
  moduleFileExtensions: ['js', 'json'],
  clearMocks: true,
  collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
  setupFiles: ['<rootDir>/src/tests/jest.setup.js']
};
