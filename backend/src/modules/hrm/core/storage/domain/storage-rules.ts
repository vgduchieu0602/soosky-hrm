import { randomUUID } from 'node:crypto';
import path from 'node:path';

/**
 * Pure storage rules — framework-free. No Express, no Mongoose, no AWS SDK.
 * Object-key shaping, per-scope MIME/size constraints and filename slugging.
 */

/** Allowed upload scopes → folder prefix inside the bucket. */
export const STORAGE_SCOPES = {
  avatar: 'avatars',
  document: 'employee-documents',
  contract: 'contracts',
} as const;
export type StorageScope = keyof typeof STORAGE_SCOPES;

const MB = 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DOC_TYPES = [
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  ...IMAGE_TYPES,
];

/** Per-scope upload constraints: allowed MIME types + max size in bytes. */
export const SCOPE_RULES: Record<StorageScope, { types: string[]; maxBytes: number }> = {
  avatar: { types: IMAGE_TYPES, maxBytes: 5 * MB },
  document: { types: DOC_TYPES, maxBytes: 10 * MB },
  contract: { types: DOC_TYPES, maxBytes: 10 * MB },
};

/** MB constant re-exported for size-limit message formatting. */
export const BYTES_PER_MB = MB;

/** Slugify a filename to ASCII so the object key stays URL-safe; keep the extension. */
export function safeKeyName(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase().slice(0, 12);
  const base = path
    .basename(fileName, path.extname(fileName))
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .toLowerCase();
  return `${base || 'file'}${ext}`;
}

/**
 * Build a unique object key for an upload. Shape:
 *   <scopePrefix>/<ownerId?>/<uuid>-<safeName>
 */
export function buildKey(scope: StorageScope, fileName: string, ownerId?: string): string {
  const prefix = STORAGE_SCOPES[scope];
  const id = randomUUID();
  const name = safeKeyName(fileName);
  return ownerId ? `${prefix}/${ownerId}/${id}-${name}` : `${prefix}/${id}-${name}`;
}
