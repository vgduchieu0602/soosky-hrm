import type { SetupTokenPurpose } from '@features/iam/domain/setup-token-purpose';
import type { AccessTokenPayload, RefreshTokenPayload } from '@features/iam/types/jwt-payload.type';

/**
 * Ports — the abstractions the application (use-cases) depends on. Concrete
 * implementations live in `infrastructure/`. IDs cross the boundary as strings;
 * adapters convert to/from Mongoose ObjectId. `Tx` is an opaque transaction
 * handle (a Mongoose ClientSession under the hood).
 */
export type Id = string;
export type Tx = unknown;

// ---- read-models the use-cases work with ----

export interface AuthUserRecord {
  id: string;
  username: string;
  email: string;
  password: string;
  status: string;
  mustChangePassword: boolean;
}

export interface PublicUserRecord {
  id: string;
  username: string;
  email: string;
  status: string;
  mustChangePassword: boolean;
}

export interface ResolvedRoles {
  ids: Id[];
  names: string[];
}

// ---- repository ports ----

export interface UserRepository {
  /** Find by username or email (case handled by adapter); includes password. */
  findByIdentifier(identifier: string): Promise<AuthUserRecord | null>;
  /** Auth-context lookup by id, including password + status. */
  findAuthById(id: Id): Promise<AuthUserRecord | null>;
  /** Public projection (no password) used by admin reads. Returns plain doc. */
  findPublicById(id: Id): Promise<Record<string, unknown> | null>;
  /** True when username/email already taken. Returns the conflicting field. */
  findConflict(username: string, email: string): Promise<{ username: string } | null>;
  create(input: {
    username: string; email: string; password: string; employeeId?: string | null;
  }): Promise<{ id: Id; doc: Record<string, unknown> }>;
  list(filter: { status?: string; search?: string }): Promise<Record<string, unknown>[]>;
  updateById(id: Id, patch: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  /** Atomic $inc of failed attempts with lock-on-threshold. */
  incrementFailedAttempts(id: Id): Promise<{ attempts: number; locked: boolean }>;
  resetLoginState(id: Id): Promise<void>;
  /** Set a new password hash + clear mustChangePassword. Returns false if missing. */
  setPassword(id: Id, passwordHash: string): Promise<boolean>;
  /** Set password via token flow (also resets attempts / unlocks). Returns the user's id or null. */
  setPasswordViaToken(id: Id, passwordHash: string): Promise<string | null>;
  /** Fetch current password hash + presence for change-password verification. */
  findPasswordById(id: Id): Promise<{ id: string; password: string } | null>;
}

export interface RoleRepository {
  /** Active role assignments for a user (excludes expired grants). */
  findActiveByUserId(userId: Id): Promise<ResolvedRoles>;
  findByName(name: string): Promise<{ id: string } | null>;
  create(input: { name: string; description: string }): Promise<{ id: Id; doc: Record<string, unknown> }>;
  findById(id: Id): Promise<Record<string, unknown> | null>;
  list(): Promise<Record<string, unknown>[]>;
  updateDescription(id: Id, description: string): Promise<Record<string, unknown> | null>;
  deleteById(id: Id): Promise<Record<string, unknown> | null>;
  // role↔permission binding
  permissionIdsOf(roleId: Id): Promise<string[]>;
  setPermissions(roleId: Id, permissionIds: Id[]): Promise<void>;
  replacePermissions(roleId: Id, permissionIds: Id[]): Promise<void>;
  clearPermissions(roleId: Id): Promise<void>;
}

export interface PermissionRepository {
  findKeysByRoleIds(roleIds: Id[]): Promise<string[]>;
  findByKey(key: string): Promise<{ id: string } | null>;
  create(input: {
    key: string; resource: string; action: string; description: string;
  }): Promise<{ id: Id; doc: Record<string, unknown> }>;
  findById(id: Id): Promise<Record<string, unknown> | null>;
  list(): Promise<Record<string, unknown>[]>;
  updateById(id: Id, patch: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  deleteById(id: Id): Promise<Record<string, unknown> | null>;
}

export interface SessionRepository {
  newSessionId(): Id;
  create(input: {
    sessionId: Id; userId: Id; refreshToken: string; userAgent?: string; ip?: string; expiresAt: Date;
  }): Promise<void>;
  findActiveByIdAndHash(sessionId: Id, refreshTokenHash: string): Promise<{ _id: string } | null>;
  rotate(sessionId: Id, newRefreshToken: string, newExpiresAt: Date): Promise<void>;
  revoke(sessionId: Id): Promise<void>;
  revokeAllForUser(userId: Id, tx?: Tx): Promise<void>;
  revokeAllForUserExcept(userId: Id, exceptSessionId: Id): Promise<void>;
}

export interface AuditLogRepository {
  create(input: {
    userId?: string | null; resource: string; action: string; resourceId?: string;
    changes?: Record<string, unknown>;
  }): Promise<void>;
  list(filter: { resource?: string; action?: string; resourceId?: string; limit?: number }): Promise<unknown>;
}

export interface PasswordSetupTokenRepository {
  deleteActiveForUser(userId: Id): Promise<void>;
  create(input: { userId: Id; tokenHash: string; purpose: SetupTokenPurpose; expiresAt: Date }): Promise<void>;
  findActiveByHash(tokenHash: string): Promise<{ userId: string; purpose: SetupTokenPurpose; expiresAt: Date } | null>;
  markUsedAndClearSiblings(tokenHash: string, userId: Id): Promise<void>;
}

// ---- infrastructure services ----

export interface Clock {
  now(): Date;
}

export interface IdValidator {
  isValid(id: Id): boolean;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
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

export interface AuditPort {
  record(entry: {
    userId?: string | null; resource: string; action: string; resourceId?: string;
    changes?: Record<string, unknown>;
  }): Promise<void>;
}

export interface EventsPort {
  userLoggedIn(p: { userId: string; sessionId: string; ip?: string; userAgent?: string }): void;
  userLocked(p: { userId: string; reason: string }): void;
  sessionReuseDetected(p: { userId: string }): void;
  sessionRevoked(p: { userId: string; sessionId: string }): void;
  passwordChanged(p: { userId: string }): void;
}
