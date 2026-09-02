import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '@shared/errors/http-error';
import { logger } from '@infra/logger/logger';

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

  // body-parser ném lỗi thô khi payload vượt giới hạn — trả 413 có thông báo rõ
  // thay vì 500 "Internal server error" khiến người dùng không biết phải làm gì.
  if ((err as { type?: string }).type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: { code: 'SYS_003', message: 'Tệp/nội dung quá lớn — hãy chia nhỏ rồi thử lại' },
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
