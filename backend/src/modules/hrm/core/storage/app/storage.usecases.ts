import { logger } from '@infra/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import {
  STORAGE_SCOPES,
  SCOPE_RULES,
  BYTES_PER_MB,
  buildKey,
  type StorageScope,
} from '@modules/hrm/core/storage/domain/storage-rules';
import type { StorageGateway } from '@modules/hrm/core/storage/domain/ports';

const log = logger.child({ module: 'storage' });

/**
 * Storage use-cases — presign upload/download URLs and best-effort deletes.
 * Depends only on the {@link StorageGateway} port; the concrete S3 adapter is
 * injected by the container.
 */
export class StorageUseCases {
  constructor(private readonly gateway: StorageGateway) {}

  /** True only when a bucket + credentials are configured. */
  isConfigured(): boolean {
    return this.gateway.isConfigured();
  }

  assertConfigured() {
    if (!this.gateway.isConfigured()) {
      throw new HttpError(503, 'File storage is not configured', 'STORAGE_001');
    }
  }

  /** Build a unique object key for an upload. */
  buildKey(scope: StorageScope, fileName: string, ownerId?: string): string {
    return buildKey(scope, fileName, ownerId);
  }

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
        `Tệp vượt quá giới hạn ${Math.round(rule.maxBytes / BYTES_PER_MB)}MB.`,
        'STORAGE_003',
      );
    }

    const key = this.buildKey(params.scope, params.fileName, params.ownerId);
    const { url, expiresIn } = await this.gateway.presignPut({ key, contentType: params.contentType });
    log.info({ scope: params.scope, key }, 'presigned upload url issued');
    return { key, uploadUrl: url, expiresIn };
  }

  /** Presign a GET URL for downloading/viewing a stored object (private bucket). */
  async presignDownload(key: string): Promise<{ url: string; expiresIn: number }> {
    this.assertConfigured();
    const { url, expiresIn } = await this.gateway.presignGet(key);
    return { url, expiresIn };
  }

  /** Best-effort delete; never throws on a missing object. */
  async remove(key: string): Promise<void> {
    if (!this.gateway.isConfigured() || !key) return;
    await this.gateway.delete(key);
  }
}

// Re-export the scope catalog for callers that only need the constants.
export { STORAGE_SCOPES, SCOPE_RULES, type StorageScope };
