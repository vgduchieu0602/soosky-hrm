import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { logger } from '@infra/logger/logger';
import { env } from '@infra/config';
import { errorHandler } from '@shared/middlewares/error-handler';
import { iamRouter } from '@features/iam';
import {
  employeeRouter,
  organizationRouter,
  settingsRouter,
  attendanceRouter,
  payrollRouter,
  periodRouter,
  performanceRouter,
  storageRouter,
  notificationRouter,
  dashboardRouter,
} from '@modules/hrm';

/**
 * Origin được phép gọi API kèm cookie.
 *
 * `origin: true` (phản chiếu mọi origin) cộng với `credentials: true` nghĩa là
 * bất kỳ trang web nào cũng gọi được API bằng cookie phiên của người dùng. Khi
 * `HTTP_CORS_ORIGINS` được khai báo thì chỉ những origin đó được phép; chỉ ở
 * môi trường không phải production mới rơi về chế độ phản chiếu cho tiện dev.
 */
function corsOrigin(): string[] | boolean {
  const configured = env.HTTP_CORS_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (configured && configured.length > 0) return configured;
  if (env.NODE_ENV === 'production') {
    logger.warn('HTTP_CORS_ORIGINS chưa đặt — CORS kèm cookie đang mở cho mọi origin');
  }
  return true;
}

export function createExpressServer() {
  //Khởi tạo Express app
  const app = express();

  //Register Middleware
  app.use(helmet());
  app.use(cors({ credentials: true, origin: corsOrigin() }));
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
  app.use('/api/v1', periodRouter);
  app.use('/api/v1', performanceRouter);
  app.use('/api/v1', storageRouter);
  app.use('/api/v1', notificationRouter);
  app.use('/api/v1', dashboardRouter);

  //Register Error Handler
  app.use(errorHandler);

  return app;
}
