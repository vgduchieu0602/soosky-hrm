import type { Request, Response, NextFunction } from 'express';
import { storageService } from '@core/storage/storage.service';
import { HttpError } from '@shared/errors/http-error';
import { signDownloadDto, type PresignUploadDto } from '@features/storage/dto/storage.dto';

export const storageController = {
  /** POST /uploads/presign — issue a presigned PUT URL for a direct-to-bucket upload. */
  async presign(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as PresignUploadDto;
      const result = await storageService.presignUpload({
        scope: body.scope,
        fileName: body.fileName,
        contentType: body.contentType,
        ownerId: body.ownerId,
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
      const result = await storageService.presignDownload(parsed.data.key);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
};
