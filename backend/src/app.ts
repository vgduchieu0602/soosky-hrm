import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { logger } from '@core/logger/logger';
import { errorHandler } from '@shared/middlewares/error-handler';
import { iamRouter } from '@features/iam';

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

  //Register Error Handler
  app.use(errorHandler);

  return app;
}
