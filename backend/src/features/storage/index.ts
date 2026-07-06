// Public surface of the storage feature (Clean Architecture).
export { default as storageRouter } from '@features/storage/interfaces/http/storage.routes';

// The storage use-cases re-exported under the legacy `storageService` name for
// callers that presign/remove objects (compat shim — same method surface:
// isConfigured/assertConfigured/buildKey/presignUpload/presignDownload/remove).
export { storageUseCases as storageService } from '@features/storage/container';
