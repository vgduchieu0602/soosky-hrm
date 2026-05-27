import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '@shared/errors/http-error';
import { logger } from '@core/logger/logger';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }
  logger.error({ err }, 'Unhandled error');
  res
    .status(500)
    .json({
      success: false,
      error: { code: 'SYS_001', message: 'Internal server error' },
    });
}
