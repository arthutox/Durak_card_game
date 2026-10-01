import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolve @durak/shared to its TypeScript sources (no build step needed for tests).
  resolve: { conditions: ['development'] },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
