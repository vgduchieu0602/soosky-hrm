/**
 * IAM ports — the abstractions the IAM use-cases depend on. Concrete
 * implementations live in `modules/iam/adapters`. IDs cross the boundary as
 * strings; adapters convert to/from Mongoose ObjectId. `Tx` is an opaque
 * transaction handle (a Mongoose ClientSession under the hood).
 *
 * These are the contracts for the identity store itself (users, roles,
 * permissions, audit trail). The Auth module re-exports the ones it needs — it
 * authenticates against the store IAM owns.
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

export interface AuditLogRepository {
  create(input: {
    userId?: string | null; resource: string; action: string; resourceId?: string;
    changes?: Record<string, unknown>;
  }): Promise<void>;
  list(filter: { resource?: string; action?: string; resourceId?: string; limit?: number }): Promise<unknown>;
}

// ---- infrastructure services ----

export interface Clock {
  now(): Date;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export interface AuditPort {
  record(entry: {
    userId?: string | null; resource: string; action: string; resourceId?: string;
    changes?: Record<string, unknown>;
  }): Promise<void>;
}
