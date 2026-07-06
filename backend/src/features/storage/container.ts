/**
 * Composition root — the only place that instantiates the concrete S3 adapter
 * and injects it into the storage use-cases. Swap the gateway here to change
 * the storage backend.
 */
import { S3StorageGateway } from '@features/storage/infrastructure/s3.gateway';
import { StorageUseCases } from '@features/storage/application/storage.usecases';

const storageGateway = new S3StorageGateway();

export const storageUseCases = new StorageUseCases(storageGateway);
