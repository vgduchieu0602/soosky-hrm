import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { logger } from '@core/logger/logger';
import { errorHandler } from '@shared/middlewares/error-handler';
import { iamRouter } from '@features/iam';
import { employeeRouter } from '@features/employee';
import { organizationRouter } from '@features/organization';
import { settingsRouter } from '@features/settings';
import { attendanceRouter } from '@features/attendance';
import { payrollRouter } from '@features/payroll';
import { performanceRouter } from '@features/performance';
import { storageRouter } from '@features/storage';
import { notificationRouter } from '@features/notification';

export function createApp() {
  //Khởi tạo Express app
  const app = express();

  //Register Middleware
  app.use(helmet());
  app.use(cors({ credentials: true, origin: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  //Reigster Route
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/v1', iamRouter);
  app.use('/api/v1', organizationRouter);
  app.use('/api/v1', employeeRouter);
  app.use('/api/v1', settingsRouter);
  app.use('/api/v1', attendanceRouter);
  app.use('/api/v1', payrollRouter);
  app.use('/api/v1', performanceRouter);
  app.use('/api/v1', storageRouter);
  app.use('/api/v1', notificationRouter);

  //Register Error Handler
  app.use(errorHandler);

  return app;
}
