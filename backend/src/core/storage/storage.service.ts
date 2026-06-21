import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@config/env';
import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';

const log = logger.child({ module: 'storage' });

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    // Backblaze B2 requires path-style addressing on the S3-compatible API.
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
    },
  });
  return client;
}

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

/** Slugify a filename to ASCII so the object key stays URL-safe; keep the extension. */
function safeKeyName(fileName: string): string {
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

export const storageService = {
  /** True only when a bucket + credentials are configured. */
  isConfigured(): boolean {
    return Boolean(
      env.S3_BUCKET && env.S3_ENDPOINT && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
    );
  },

  assertConfigured() {
    if (!this.isConfigured()) {
      throw new HttpError(503, 'File storage is not configured', 'STORAGE_001');
    }
  },

  /**
   * Build a unique object key for an upload. Shape:
   *   <scopePrefix>/<ownerId?>/<uuid>-<safeName>
   */
  buildKey(scope: StorageScope, fileName: string, ownerId?: string): string {
    const prefix = STORAGE_SCOPES[scope];
    const id = randomUUID();
    const name = safeKeyName(fileName);
    return ownerId ? `${prefix}/${ownerId}/${id}-${name}` : `${prefix}/${id}-${name}`;
  },

  /**
   * Presign a PUT URL the client uploads to directly. Returns the URL plus the
   * object `key` to persist (store the key, never the signed URL).
   */
  async presignUpload(params: {
    scope: StorageScope;
    fileName: string;
    contentType: string;
    ownerId?: string;
    size?: number;
  }): Promise<{ key: string; uploadUrl: string; expiresIn: number }> {
    this.assertConfigured();

    // Enforce per-scope file-type whitelist and size cap.
    const rule = SCOPE_RULES[params.scope];
    if (!rule.types.includes(params.contentType)) {
      throw new HttpError(
        422,
        'Loại tệp không được hỗ trợ. Chỉ chấp nhận PDF, Word hoặc ảnh.',
        'STORAGE_002',
      );
    }
    if (params.size != null && params.size > rule.maxBytes) {
      throw new HttpError(
        413,
        `Tệp vượt quá giới hạn ${Math.round(rule.maxBytes / MB)}MB.`,
        'STORAGE_003',
      );
    }

    const key = this.buildKey(params.scope, params.fileName, params.ownerId);
    const cmd = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ContentType: params.contentType,
    });
    const uploadUrl = await getSignedUrl(getClient(), cmd, { expiresIn: env.S3_PRESIGN_TTL });
    log.info({ scope: params.scope, key }, 'presigned upload url issued');
    return { key, uploadUrl, expiresIn: env.S3_PRESIGN_TTL };
  },

  /** Presign a GET URL for downloading/viewing a stored object (private bucket). */
  async presignDownload(key: string): Promise<{ url: string; expiresIn: number }> {
    this.assertConfigured();
    const cmd = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key });
    const url = await getSignedUrl(getClient(), cmd, { expiresIn: env.S3_PRESIGN_TTL });
    return { url, expiresIn: env.S3_PRESIGN_TTL };
  },

  /** Best-effort delete; never throws on a missing object. */
  async remove(key: string): Promise<void> {
    if (!this.isConfigured() || !key) return;
    try {
      await getClient().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      log.info({ key }, 'object deleted');
    } catch (err) {
      log.warn({ err, key }, 'failed to delete object');
    }
  },
};
