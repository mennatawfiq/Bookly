import './lib/sentry';
import { app } from './app';
import { logger } from './lib/logger';

const port = process.env.PORT;

const server = app.listen(port, () => {
  logger.info(
    {
      port,
      env: process.env.NODE_ENV,
    },
    'Bookly server started successfully',
  );
});

server.on('error', (err) => {
  logger.fatal({ err, port }, 'Failed to start HTTP server');

  process.exitCode = 1;
});
