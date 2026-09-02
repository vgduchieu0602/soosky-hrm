/**
 * Ports — the abstractions the application (use-cases) depends on. The concrete
 * implementation lives in `infrastructure/` (an S3-compatible adapter). No AWS
 * SDK, Express or Mongoose types cross this boundary.
 */

/** A presigned URL plus its TTL in seconds. */
export interface PresignedUrl {
  url: string;
  expiresIn: number;
}

/**
 * Object-storage gateway — wraps the S3-compatible client (presign + delete).
 * `isConfigured()` reflects whether a bucket + credentials are available.
 */
export interface StorageGateway {
  isConfigured(): boolean;
  /** Presign a PUT URL for a direct-to-bucket upload of `contentType` at `key`. */
  presignPut(params: { key: string; contentType: string }): Promise<PresignedUrl>;
  /** Presign a GET URL for downloading/viewing a stored object. */
  presignGet(key: string): Promise<PresignedUrl>;
  /** Best-effort delete; never throws on a missing object or an unconfigured store. */
  delete(key: string): Promise<void>;
}
