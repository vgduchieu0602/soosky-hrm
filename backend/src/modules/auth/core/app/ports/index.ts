/**
 * Auth ports — the abstractions the Auth use-cases depend on. Concrete
 * implementations live in `modules/auth/adapters`.
 *
 * Auth answers "who is this user?", so it reads the identity store that IAM
 * owns: the user/role/permission contracts below are re-exported from IAM and
 * satisfied by IAM's repositories, wired in by the composition root. Sessions,
 * tokens and password-setup links are owned by Auth itself.
 */
import type { SetupTokenPurpose } from '@modules/auth/adapters/persistence/models/password-setup-token.model';
import type { AccessTokenPayload, RefreshTokenPayload } from '@shared/types/jwt-payload.type';

export type {
  Id,
  Tx,
  AuthUserRecord,
  ResolvedRoles,
  UserRepository,
  RoleRepository,
  PermissionRepository,
  AuditPort,
  PasswordHasher,
  Clock,
} from '@modules/iam/core/app/ports';

import type { Id } from '@modules/iam/core/app/ports';

// ---- repository ports owned by Auth ----

export interface SessionRepository {
  newSessionId(): Id;
  create(input: {
    sessionId: Id; userId: Id; refreshToken: string; userAgent?: string; ip?: string; expiresAt: Date;
  }): Promise<void>;
  findActiveByIdAndHash(sessionId: Id, refreshTokenHash: string): Promise<{ _id: string } | null>;
  rotate(sessionId: Id, newRefreshToken: string, newExpiresAt: Date): Promise<void>;
  revoke(sessionId: Id): Promise<void>;
  revokeAllForUser(userId: Id, tx?: unknown): Promise<void>;
  revokeAllForUserExcept(userId: Id, exceptSessionId: Id): Promise<void>;
}

export interface PasswordSetupTokenRepository {
  deleteActiveForUser(userId: Id): Promise<void>;
  create(input: { userId: Id; tokenHash: string; purpose: SetupTokenPurpose; expiresAt: Date }): Promise<void>;
  findActiveByHash(tokenHash: string): Promise<{ userId: string; purpose: SetupTokenPurpose; expiresAt: Date } | null>;
  markUsedAndClearSiblings(tokenHash: string, userId: Id): Promise<void>;
}

// ---- infrastructure services owned by Auth ----

export interface IdValidator {
  isValid(id: Id): boolean;
}

export interface RefreshTokenHasher {
  hash(token: string): string;
}

export interface TokenHasher {
  /** Hash a raw single-use token for at-rest storage/lookup. */
  hash(raw: string): string;
  /** Generate a fresh URL-safe random token. */
  generate(): string;
}

export interface TokenIssuer {
  signAccess(input: {
    userId: string; sessionId: string; roles: string[]; permissions: string[]; mustChangePassword?: boolean;
  }): string;
  signRefresh(input: { userId: string; sessionId: string; tokenVersion: number }): string;
  verifyRefresh(token: string): RefreshTokenPayload;
  verifyAccess(token: string): AccessTokenPayload;
  refreshTtlMs(): number;
}

export interface EventsPort {
  userLoggedIn(p: { userId: string; sessionId: string; ip?: string; userAgent?: string }): void;
  userLocked(p: { userId: string; reason: string }): void;
  sessionReuseDetected(p: { userId: string }): void;
  sessionRevoked(p: { userId: string; sessionId: string }): void;
  passwordChanged(p: { userId: string }): void;
}
