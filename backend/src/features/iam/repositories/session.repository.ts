/**
 * Compatibility re-export. The session repository moved to
 * infrastructure/session.repository.mongoose (wired in container.ts). This shim
 * preserves the historical deep-import path
 * `@features/iam/repositories/session.repository` used by the employee feature
 * (which calls `sessionRepository.revokeAllForUser(userId, clientSession)`).
 */
export { sessionRepo as sessionRepository } from '@features/iam/container';
