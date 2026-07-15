import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Use the automatic JSX runtime for tests so component test files don't need
  // an explicit React import (matches the React 19 setup used by consumers).
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // The optional (`*`) test tasks may not be implemented yet; don't fail the
    // suite purely because no test files exist. Real test failures still fail.
    passWithNoTests: true,
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/**/__tests__/**/*.{ts,tsx}',
    ],
  },
});
