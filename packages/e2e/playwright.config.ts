import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

/**
 * Runs against the built production server (Express serves the client), the
 * same way the game is played: `pnpm build` must have run first.
 * Locally, `PW_CHANNEL=chrome` uses the installed Chrome instead of a download.
 */
export default defineConfig({
  testDir: 'tests',
  // One server means one room: tests must not run side by side.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    ...(process.env['PW_CHANNEL'] ? { channel: process.env['PW_CHANNEL'] } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --filter @durak/server start',
    url: `http://localhost:${PORT}/health`,
    env: { PORT: String(PORT), LOG_LEVEL: 'warn' },
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
  },
});
