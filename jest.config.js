module.exports = {
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/example/', '<rootDir>/lib/'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: ['node_modules/'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
};
