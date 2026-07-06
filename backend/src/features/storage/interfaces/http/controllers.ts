import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '@shared/errors/http-error';
import { storageUseCases } from '@features/storage/container';
import { signDownloadDto, type PresignUploadDto } from '@features/storage/dto/storage.dto';

export const storageController = {
  /** POST /uploads/presign — issue a presigned PUT URL for a direct-to-bucket upload. */
  async presign(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as PresignUploadDto;
      const result = await storageUseCases.presignUpload({
        scope: body.scope,
        fileName: body.fileName,
        contentType: body.contentType,
        ownerId: body.ownerId,
        size: body.size,
      });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },

  /** GET /uploads/sign?key=... — issue a short-lived presigned GET URL for viewing. */
  async sign(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = signDownloadDto.safeParse(req.query);
      if (!parsed.success) throw new HttpError(422, 'Validation Error', 'SYS_002');
      const result = await storageUseCases.presignDownload(parsed.data.key);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
};
