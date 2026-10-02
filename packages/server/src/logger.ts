/**
 * Minimal structured logger: one JSON-ish line per event, easy to grep.
 * Never pass secrets (session tokens) in `fields`.
 */
type Fields = Record<string, unknown>;
type Level = 'info' | 'warn' | 'error';

const RANK: Record<Level, number> = { info: 0, warn: 1, error: 2 };

/** `LOG_LEVEL=warn|error` silences chattier levels (tests run with `error`). */
function threshold(): number {
  const configured = process.env['LOG_LEVEL'];
  return configured === 'info' || configured === 'warn' || configured === 'error'
    ? RANK[configured]
    : RANK.info;
}

function write(level: Level, message: string, fields?: Fields): void {
  if (RANK[level] < threshold()) return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (fields) sink(line, fields);
  else sink(line);
}

export const logger = {
  info: (message: string, fields?: Fields) => write('info', message, fields),
  warn: (message: string, fields?: Fields) => write('warn', message, fields),
  error: (message: string, fields?: Fields) => write('error', message, fields),
};
