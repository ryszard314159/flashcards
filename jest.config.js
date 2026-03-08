export default {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js'
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {},
  moduleNameMapper: {},
};
