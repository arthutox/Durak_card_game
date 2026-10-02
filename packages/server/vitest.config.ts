import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolve @durak/shared to its TypeScript sources (no build step needed for tests).
  resolve: { conditions: ['development'] },
  test: {
    env: { LOG_LEVEL: 'error' },
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
