/**
 * Composition root — the only place that instantiates the concrete S3 adapter
 * and injects it into the storage use-cases. Swap the gateway here to change
 * the storage backend.
 */
import { S3StorageGateway } from '@modules/hrm/adapters/object-storage/s3.gateway';
import { StorageUseCases } from '@modules/hrm/core/storage/app/storage.usecases';

const storageGateway = new S3StorageGateway();

export const storageUseCases = new StorageUseCases(storageGateway);
