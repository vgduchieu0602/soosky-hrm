import mongoose, { Types } from 'mongoose';

import { logger } from '@core/logger/logger';
import { eventBus } from '@core/events/event-bus';
import { HttpError } from '@shared/errors/http-error';

import { User } from '@shared/models/user.model';
import { Role } from '@shared/models/role.model';
import { UserRole } from '@shared/models/user-role.model';
import { Session } from '@shared/models/session.model';
import { Employee } from '@shared/models/employee.model';
import { auditService } from '@features/iam/services/audit.service';

import type { UpdateAccountDto } from '@features/employee/dto/account.dto';

// Extend the typed event bus via declaration merging (per event-bus.ts contract).
declare module '@core/events/event-bus' {
  interface AppEventMap {
    'employee.account.password-reset': {
      userId: string;
      employeeId: string;
      username: string;
      sendTo?: string;
    };
    'employee.account.invite-resent': {
      userId: string;
      employeeId: string;
      username: string;
      sendTo?: string;
    };
  }
}

const log = logger.child({ feature: 'employee', module: 'account' });

async function loadUserForEmployee(employeeId: string) {
  if (!Types.ObjectId.isValid(employeeId)) {
    throw new HttpError(400, 'Invalid employee id', 'EMP_001');
  }
  const employee = await Employee.findById(employeeId);
  if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');
  if (!employee.userId) {
    throw new HttpError(409, 'Employee has no login account', 'EMP_010');
  }
  const user = await User.findById(employee.userId);
  if (!user) throw new HttpError(404, 'Linked user account not found', 'IAM_002');
  return { employee, user };
}

async function roleNameOf(userId: Types.ObjectId): Promise<string> {
  const ur = await UserRole.findOne({ userId }).populate<{ roleId: { name: string } }>(
    'roleId',
    'name',
  );
  return ur?.roleId?.name ?? 'employee';
}

export const employeeAccountService = {
  /** Account summary for the Account tab. Never throws for "no account" — returns hasAccount:false. */
  async getAccount(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) {
      throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    }
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');
    if (!employee.userId) return { hasAccount: false as const };

    const user = await User.findById(employee.userId);
    if (!user) return { hasAccount: false as const };

    return {
      hasAccount: true as const,
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      role: await roleNameOf(user._id),
      status: user.status,
      lastLoginAt: user.lastLoginAt ?? null,
      mustChangePassword: user.mustChangePassword,
      mfaEnabled: false,
    };
  },

  /** Email the employee a fresh "set new password" link (no password is set here). */
  async resetPassword(employeeId: string, auditUserId: string) {
    const { employee, user } = await loadUserForEmployee(employeeId);
    user.failedLoginAttempts = 0;
    if (user.status === 'locked') user.status = 'active';
    await user.save();

    await auditService.record({
      userId: auditUserId,
      resource: 'user',
      action: 'update',
      resourceId: user._id.toString(),
      changes: { passwordResetLinkSent: true },
    });

    eventBus.emit('employee.account.password-reset', {
      userId: user._id.toString(),
      employeeId: employee._id.toString(),
      username: user.username,
      sendTo: user.email,
    });

    log.info({ employeeId, userId: user._id }, 'account password-reset link sent');
    return { userId: user._id.toString(), linkSentTo: user.email };
  },

  /** Re-send the activation invite (a fresh set-password link). */
  async resendInvite(employeeId: string, auditUserId: string) {
    const { employee, user } = await loadUserForEmployee(employeeId);

    await auditService.record({
      userId: auditUserId,
      resource: 'user',
      action: 'update',
      resourceId: user._id.toString(),
      changes: { inviteResent: true },
    });

    eventBus.emit('employee.account.invite-resent', {
      userId: user._id.toString(),
      employeeId: employee._id.toString(),
      username: user.username,
      sendTo: user.email,
    });

    log.info({ employeeId, userId: user._id }, 'account invite resent');
    return { userId: user._id.toString(), linkSentTo: user.email };
  },

  /** Enable/disable login and/or change the assigned role. */
  async update(employeeId: string, input: UpdateAccountDto, auditUserId: string) {
    const { user } = await loadUserForEmployee(employeeId);

    if (input.status) {
      user.status = input.status;
      await user.save();
      if (input.status === 'disabled') {
        // Revoke all active sessions so the disabled user is signed out everywhere.
        await Session.updateMany(
          { userId: user._id, revokedAt: { $exists: false } },
          { $set: { revokedAt: new Date() } },
        );
      }
    }

    if (input.role) {
      const role = await Role.findOne({ name: input.role });
      if (!role) throw new HttpError(404, `Role '${input.role}' not found`, 'IAM_008');
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await UserRole.deleteMany({ userId: user._id }, { session });
          await UserRole.create(
            [{ userId: user._id, roleId: role._id, assignedAt: new Date() }],
            { session },
          );
        });
      } finally {
        await session.endSession();
      }
    }

    await auditService.record({
      userId: auditUserId,
      resource: 'user',
      action: 'update',
      resourceId: user._id.toString(),
      changes: input as Record<string, unknown>,
    });

    log.info({ employeeId, userId: user._id }, 'account updated');
    return this.getAccount(employeeId);
  },
};
