/**
 * Compatibility re-export. The audit service moved to the Clean Architecture
 * layers (application/audit.usecases + infrastructure/audit-log.repository.mongoose,
 * wired in container.ts). This shim preserves the historical deep-import path
 * `@features/iam/services/audit.service` used across other features.
 */
export { auditUseCases as auditService } from '@features/iam/container';
export type { AuditAction } from '@features/iam/infrastructure/audit-log.repository.mongoose';
