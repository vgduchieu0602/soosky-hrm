import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { validate } from '@shared/middlewares/validate';
import { storageController } from '@features/storage/interfaces/http/controllers';
import { presignUploadDto } from '@features/storage/dto/storage.dto';

const router = Router();

// Any authenticated user can request a presigned URL. The object key is scoped
// (avatars / employee-documents / contracts) and namespaced by ownerId.
router.post(
  '/uploads/presign',
  authenticate,
  validate(presignUploadDto, 'body'),
  storageController.presign,
);
// Note: req.query is a read-only getter in Express 5, so the key is validated
// inside the controller rather than via the (reassigning) validate middleware.
router.get('/uploads/sign', authenticate, storageController.sign);

export default router;
