import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

export interface ServerConfig {
  /** Port the HTTP + Socket.IO server listens on. */
  readonly port: number;
  /**
   * Port phones should open. Equals `port` in production (Express serves the
   * client); in development it is the Vite dev server port.
   */
  readonly publicPort: number;
  readonly isProduction: boolean;
  /** Built client (packages/client/dist), served by Express in production. */
  readonly clientDistDir: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const isProduction = env.NODE_ENV === 'production';
  const port = parsePort(env.PORT, 3000);
  return {
    port,
    publicPort: parsePort(env.PUBLIC_PORT, isProduction ? port : 5173),
    isProduction,
    // Same relative depth from src/ (tsx) and dist/ (compiled): <pkg>/<src|dist>/config.*
    clientDistDir: fileURLToPath(new URL('../../client/dist', import.meta.url)),
  };
}

function parsePort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${raw}`);
  }
  return port;
}

const PRIVATE_IPV4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

/**
 * Best guess at the laptop's address on the local network, used for the QR
 * code. Prefers private IPv4 ranges (home Wi-Fi) over anything else.
 */
export function getLanAddress(): string {
  const candidates = Object.values(networkInterfaces())
    .flat()
    .filter((info) => info !== undefined && info.family === 'IPv4' && !info.internal)
    .map((info) => info!.address);

  return candidates.find((address) => PRIVATE_IPV4.test(address)) ?? candidates[0] ?? 'localhost';
}

export function buildJoinUrl(host: string, port: number): string {
  return `http://${host}:${port}/play`;
}
