import { createApp } from './app';
import { connectDB, disconnectDB } from '@core/database/mongoose';
import { env } from '@config/env';
import { logger } from '@core/logger/logger';
import { registerAccountEmailListeners } from '@features/employee/listeners/account-email.listener';
import { mailService } from '@core/mail/mail.service';

async function bootstrap() {
  //connect database
  await connectDB();

  //Register domain event listeners (e.g. credential emails)
  registerAccountEmailListeners();

  //Check mail transport (logs readiness / falls back to dev log transport)
  await mailService.verify();

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
