import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import type { Express } from 'express';
import { logger } from '../logger.js';

/**
 * Serves the built React app and falls back to index.html for client-side
 * routes (/board, /play). In development Vite serves the client instead.
 */
export function serveClient(app: Express, distDir: string): void {
  const indexHtml = join(distDir, 'index.html');
  if (!existsSync(indexHtml)) {
    logger.warn('client build not found, run `pnpm build` first', { distDir });
    return;
  }

  app.use(express.static(distDir, { index: false }));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(indexHtml);
  });
}
