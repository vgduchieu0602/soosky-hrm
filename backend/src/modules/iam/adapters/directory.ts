/**
 * Identity-directory adapter — the operations another module needs against the
 * identity store, exposed so no one else has to touch IAM's collections.
 *
 * HRM provisions an account when an employee is granted login, renames it when
 * the employee's email changes, and removes it when the employee record is
 * deleted. Those writes have to join HRM's own transaction, so every mutating
 * method takes the caller's opaque transaction handle (a Mongoose
 * ClientSession) — the same contract IAM's repositories already use.
 */
import { Types, type ClientSession } from 'mongoose';
import { User } from '@modules/iam/adapters/persistence/models/user.model';
import { Role } from '@modules/iam/adapters/persistence/models/role.model';
import { UserRole } from '@modules/iam/adapters/persistence/models/user-role.model';
import { AuditLog } from '@modules/iam/adapters/persistence/models/audit-log.model';
import type { Id, Tx } from '@modules/iam/core/app/ports';
import { credentialUseCases } from '@modules/iam/adapters/container';

const sess = (tx?: Tx) => (tx ? (tx as ClientSession) : undefined);

export interface DirectoryUserRecord {
  id: string;
  username: string;
  email: string;
  status: string;
  lastLoginAt: Date | null;
  mustChangePassword: boolean;
}

export interface DirectoryUserPatch {
  username?: string;
  email?: string;
  /**
   * Replace the stored credential with one nobody knows, so the account cannot
   * be logged into until the user sets a password through the emailed link.
   * The caller asks for the effect; IAM owns what a credential is.
   */
  resetCredential?: boolean;
  status?: string;
  mustChangePassword?: boolean;
  failedLoginAttempts?: number;
  /** Unlock an account that was locked out by failed logins. */
  activateIfLocked?: boolean;
}

export interface DirectoryAuditEntry {
  userId: string;
  resource: string;
  action: string;
  resourceId: string;
  changes?: Record<string, unknown>;
}

function toRecord(u: {
  _id: unknown;
  username: string;
  email: string;
  status: string;
  lastLoginAt?: Date | null;
  mustChangePassword: boolean;
}): DirectoryUserRecord {
  return {
    id: String(u._id),
    username: u.username,
    email: u.email,
    status: u.status,
    lastLoginAt: u.lastLoginAt ?? null,
    mustChangePassword: u.mustChangePassword,
  };
}

export const iamDirectory = {
  async findRoleIdByName(name: string): Promise<string | null> {
    const r = await Role.findOne({ name }).select('_id').lean();
    return r ? String(r._id) : null;
  },

  async getUser(userId: Id): Promise<DirectoryUserRecord | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    const u = await User.findById(userId).lean();
    return u ? toRecord(u as never) : null;
  },

  async getUserByEmployeeId(employeeId: Id): Promise<DirectoryUserRecord | null> {
    const u = await User.findOne({ employeeId: new Types.ObjectId(employeeId) }).lean();
    return u ? toRecord(u as never) : null;
  },

  async findUserConflict(
    username: string,
    email: string,
    exceptUserId?: Id,
  ): Promise<{ username: string } | null> {
    const filter: Record<string, unknown> = { $or: [{ username }, { email }] };
    if (exceptUserId) filter._id = { $ne: new Types.ObjectId(exceptUserId) };
    const dup = await User.findOne(filter).select('username').lean();
    return dup ? { username: (dup as { username: string }).username } : null;
  },

  /** Name of the user's first role assignment; `employee` when unassigned. */
  async roleNameOf(userId: Id): Promise<string> {
    const ur = await UserRole.findOne({ userId }).select('roleId').lean();
    if (!(ur as { roleId?: unknown })?.roleId) return 'employee';
    const role = await Role.findById((ur as { roleId: unknown }).roleId).select('name').lean();
    return (role as { name?: string })?.name ?? 'employee';
  },

  /** User ids holding any of the named roles. */
  async userIdsByRoles(roleNames: string[]): Promise<string[]> {
    const roles = await Role.find({ name: { $in: roleNames } }).select('_id').lean();
    if (roles.length === 0) return [];
    const links = await UserRole.find({ roleId: { $in: roles.map((r) => r._id) } })
      .select('userId')
      .lean();
    return [...new Set(links.map((l) => String(l.userId)))];
  },

  /**
   * Provision an account. No credential is passed in: the row is seeded with an
   * unusable one, and the user sets a real password via the emailed link.
   */
  async createUser(
    data: {
      username: string;
      email: string;
      employeeId: string;
      status: string;
      mustChangePassword: boolean;
      failedLoginAttempts: number;
    },
    tx: Tx,
  ): Promise<{ id: string }> {
    const [user] = await User.create(
      [
        {
          username: data.username,
          email: data.email,
          password: await credentialUseCases.unusable(),
          employeeId: new Types.ObjectId(data.employeeId),
          status: data.status,
          mustChangePassword: data.mustChangePassword,
          failedLoginAttempts: data.failedLoginAttempts,
        },
      ] as never[],
      { session: sess(tx) },
    );
    return { id: String(user!._id) };
  },

  async assignRole(userId: Id, roleId: Id, tx: Tx): Promise<void> {
    await UserRole.create([{ userId, roleId, assignedAt: new Date() }], { session: sess(tx) });
  },

  async replaceRoles(userId: Id, roleId: Id, tx: Tx): Promise<void> {
    await UserRole.deleteMany({ userId }, { session: sess(tx) });
    await UserRole.create([{ userId, roleId, assignedAt: new Date() }], { session: sess(tx) });
  },

  async updateUserAccount(userId: Id, patch: DirectoryUserPatch, tx?: Tx): Promise<void> {
    const user = await User.findById(userId).session(sess(tx) ?? null);
    if (!user) return;
    if (patch.username !== undefined) user.username = patch.username;
    if (patch.email !== undefined) user.email = patch.email;
    if (patch.resetCredential) user.password = await credentialUseCases.unusable();
    if (patch.mustChangePassword !== undefined) user.mustChangePassword = patch.mustChangePassword;
    if (patch.failedLoginAttempts !== undefined) user.failedLoginAttempts = patch.failedLoginAttempts;
    if (patch.status !== undefined) user.status = patch.status as never;
    if (patch.activateIfLocked && user.status === 'locked') user.status = 'active';
    await user.save({ session: sess(tx) });
  },

  async disableUser(userId: Id, tx: Tx): Promise<void> {
    await User.updateOne({ _id: userId }, { $set: { status: 'disabled' } }, { session: sess(tx) });
  },

  /** Remove a user together with its role assignments (employee deletion). */
  async deleteUserWithRoles(userId: Id, tx: Tx): Promise<void> {
    const session = sess(tx);
    await UserRole.deleteMany({ userId: new Types.ObjectId(userId) }, { session });
    await User.deleteOne({ _id: new Types.ObjectId(userId) }, { session });
  },

  async writeUserAudit(entry: DirectoryAuditEntry, tx?: Tx): Promise<void> {
    await AuditLog.create(
      [
        {
          userId: new Types.ObjectId(entry.userId),
          resource: entry.resource,
          action: entry.action,
          resourceId: new Types.ObjectId(entry.resourceId),
          changes: entry.changes,
          timestamp: new Date(),
        },
      ],
      { session: sess(tx) },
    );
  },

  /** Most recent audit entries, newest first (dashboard activity feed). */
  async recentAuditLogs(
    limit: number,
  ): Promise<{ action: string; resource: string; timestamp: Date }[]> {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(limit).lean();
    return logs.map((l) => ({ action: l.action, resource: l.resource, timestamp: l.timestamp }));
  },
};
