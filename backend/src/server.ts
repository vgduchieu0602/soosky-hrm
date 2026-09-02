import { createExpressServer } from '@infra/server/createExpressServer';
import { connectDB, disconnectDB } from '@infra/db/mongoose';
import { env } from '@infra/config';
import { logger } from '@infra/logger/logger';
import { registerAccountEmailListeners } from '@features/employee/listeners/account-email.listener';
import { registerNotificationListeners } from '@features/notification';
import { registerReminderJobs } from '@features/employee/jobs/reminder.job';
import { mailService } from '@infra/mail/mail.service';

async function bootstrap() {
  //connect database
  await connectDB();

  //Register domain event listeners (e.g. credential emails + in-app notifications)
  registerAccountEmailListeners();
  registerNotificationListeners();
  registerReminderJobs();

  //Check mail transport (logs readiness / falls back to dev log transport)
  await mailService.verify();

  //Start HTTP Server
  const app = createExpressServer();
  
  const server = app.listen(env.PORT, () =>
    logger.info(`API listening on :${env.PORT}`),
  );

  // Don't fail silently: a listen error (e.g. port already in use) is emitted as
  // an event, not a throw — surface it loudly and exit.
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${env.PORT} đang bị chiếm bởi tiến trình khác. Dừng tiến trình đó hoặc đổi PORT trong .env.`);
    } else {
      logger.error({ err }, 'HTTP server error');
    }
    process.exit(1);
  });

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
