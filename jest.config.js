module.exports = {
  testEnvironment: 'node',
  // `.claude/` holds git worktrees and bundles created by tooling, each a full
  // copy of this repository including __tests__. Jest would otherwise collect
  // those copies as well as the real suite, and a copy made before a syntax or
  // config change fails to parse, so `npm test` reports failing suites that
  // have nothing to do with the working tree. The directory is gitignored, so
  // this never affects CI, where it does not exist; it is local noise that
  // makes the test command untrustworthy for whoever is actually running it.
  // These patterns are regular expressions, hence the escaped dot: unescaped,
  // it would also match any single character in that position.
  modulePathIgnorePatterns: [
    '<rootDir>/example/',
    '<rootDir>/lib/',
    '<rootDir>/\\.claude/',
  ],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: ['node_modules/'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
};
