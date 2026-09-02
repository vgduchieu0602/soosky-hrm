import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@infra/config';
import { logger } from '@infra/logger/logger';
import type { StorageGateway, PresignedUrl } from '@features/storage/domain/ports';

const log = logger.child({ module: 'storage' });

/**
 * S3-compatible object-storage adapter (Backblaze B2). The only place that
 * touches the AWS SDK. Lazily constructs the client on first use.
 */
export class S3StorageGateway implements StorageGateway {
  private client: S3Client | null = null;

  private getClient(): S3Client {
    if (this.client) return this.client;
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      // Backblaze B2 requires path-style addressing on the S3-compatible API.
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID as string,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
      },
    });
    return this.client;
  }

  isConfigured(): boolean {
    return Boolean(
      env.S3_BUCKET && env.S3_ENDPOINT && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
    );
  }

  async presignPut(params: { key: string; contentType: string }): Promise<PresignedUrl> {
    const cmd = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: params.key,
      ContentType: params.contentType,
    });
    const url = await getSignedUrl(this.getClient(), cmd, { expiresIn: env.S3_PRESIGN_TTL });
    return { url, expiresIn: env.S3_PRESIGN_TTL };
  }

  async presignGet(key: string): Promise<PresignedUrl> {
    const cmd = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key });
    const url = await getSignedUrl(this.getClient(), cmd, { expiresIn: env.S3_PRESIGN_TTL });
    return { url, expiresIn: env.S3_PRESIGN_TTL };
  }

  async delete(key: string): Promise<void> {
    if (!this.isConfigured() || !key) return;
    try {
      await this.getClient().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      log.info({ key }, 'object deleted');
    } catch (err) {
      log.warn({ err, key }, 'failed to delete object');
    }
  }
}
