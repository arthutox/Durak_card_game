import { buildJoinUrl, getLanAddress, loadConfig } from './config.js';
import { createGameServer } from './createGameServer.js';
import { logger } from './logger.js';

const config = loadConfig();
const lanAddress = getLanAddress();
const joinUrl = buildJoinUrl(lanAddress, config.publicPort);

const { httpServer, io, flow } = createGameServer(config, joinUrl);

// 0.0.0.0: reachable from phones on the same Wi-Fi, not only from localhost.
httpServer.listen(config.port, '0.0.0.0', () => {
  logger.info('server started', {
    mode: config.isProduction ? 'production' : 'development',
    board: `http://localhost:${config.publicPort}/board`,
    join: joinUrl,
  });
});

function shutdown(signal: string): void {
  logger.info('shutting down', { signal });
  flow.dispose();
  void io.close();
  httpServer.close(() => process.exit(0));
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
