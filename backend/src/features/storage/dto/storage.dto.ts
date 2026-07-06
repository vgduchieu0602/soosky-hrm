import { z } from 'zod';
import { STORAGE_SCOPES } from '@features/storage/domain/storage-rules';

const scopes = Object.keys(STORAGE_SCOPES) as [keyof typeof STORAGE_SCOPES];

export const presignUploadDto = z
  .object({
    scope: z.enum(scopes),
    fileName: z.string().min(1).max(255).trim(),
    contentType: z.string().min(1).max(160).trim(),
    // Optional owner (e.g. employeeId) used to namespace the object key.
    ownerId: z.string().max(64).optional(),
    // Declared file size in bytes — validated against the per-scope cap.
    size: z.coerce.number().int().positive().optional(),
  })
  .strict();
export type PresignUploadDto = z.infer<typeof presignUploadDto>;

export const signDownloadDto = z
  .object({
    key: z.string().min(1).max(1024),
  })
  .strict();
export type SignDownloadDto = z.infer<typeof signDownloadDto>;
