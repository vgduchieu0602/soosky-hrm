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
  }): Promise<{ key: string; uploadUrl: string; expiresIn: number }> {
    this.assertConfigured();
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
