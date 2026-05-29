import { createApp } from './app';
import { connectDB, disconnectDB } from '@core/database/mongoose';
import { env } from '@config/env';
import { logger } from '@core/logger/logger';

async function bootstrap() {
  //connect database
  await connectDB();

  //Start HTTP Server
  const app = createApp();
  
  const server = app.listen(env.PORT, () =>
    logger.info(`API listening on :${env.PORT}`),
  );

  //Graceful shutdown
  const shutdown = async () => {
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}


bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal');
  process.exit(1);
});
