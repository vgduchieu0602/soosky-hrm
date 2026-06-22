import mongoose, { Types } from 'mongoose';
import { randomBytes } from 'node:crypto';

import { logger } from '@core/logger/logger';
import { eventBus } from '@core/events/event-bus';
import { HttpError } from '@shared/errors/http-error';
import { hashPassword } from '@shared/utils/hash.util';
import { generateRandomPassword } from '@shared/utils/password.util';

import { User } from '@shared/models/user.model';
import { Role } from '@shared/models/role.model';
import { UserRole } from '@shared/models/user-role.model';
import { Employee, type EmployeeDoc } from '@shared/models/employee.model';
import { EmployeeProfile } from '@shared/models/employee-profile.model';
import { AuditLog } from '@shared/models/audit-log.model';

import type { GrantLoginDto } from '@features/employee/dto/grant-login.dto';

const log = logger.child({ feature: 'employee', module: 'account-provisioning' });

const EMPLOYEE_ROLE_NAME = 'employee';

interface GrantResult {
  userId: string;
  username: string;
  linkSentTo: string | null;
}

function deriveUsername(email?: string, employeeCode?: string): string {
  if (email) return email.split('@')[0]!.toLowerCase();
  if (employeeCode) return employeeCode.toLowerCase().replace(/[^a-z0-9.]+/g, '.');
  return `user.${randomBytes(3).toString('hex')}`;
}

export const accountProvisioningService = {
  /**
   * Provision (or re-provision) a user account for an existing employee.
   *
   * - The personal email may be supplied via `dto.email` when the profile has
   *   none (or to correct it); it is persisted back to the profile and used as
   *   the invite recipient.
   * - If the employee already has a login account, this acts as a RE-PROVISION:
   *   it updates the username/email when changed, regenerates the (unusable)
   *   placeholder password, and re-sends the activation invite.
   *
   * Atomic across users, employees.userId, userRoles, auditLogs.
   * Emits `employee.granted-login` so the email worker can send the setup link.
   */
  async grantLogin(employeeId: string, dto: GrantLoginDto, hrUserId: string): Promise<GrantResult> {
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');

    const profile = await EmployeeProfile.findOne({ employeeId: employee._id });
    // Resolve the email: an explicit override wins, else the profile email.
    const email = (dto.email ?? profile?.email)?.trim().toLowerCase();
    if (!email) {
      throw new HttpError(
        400,
        'Cannot grant login: employee has no personal email — please provide one',
        'EMP_008',
      );
    }
    // Persist a supplemented/corrected email back to the profile.
    if (profile && dto.email && profile.email !== email) {
      profile.email = email;
      await profile.save();
    }

    // Re-provision path: the employee already has an account.
    if (employee.userId) {
      return this.reprovision(employee, dto, email, hrUserId);
    }

    const username = (dto.username ?? deriveUsername(email, employee.employeeCode)).trim();

    const employeeRole = await Role.findOne({ name: EMPLOYEE_ROLE_NAME });
    if (!employeeRole) {
      throw new HttpError(500, "System role 'employee' is missing", 'IAM_009');
    }

    const dup = await User.findOne({ $or: [{ username }, { email }] });
    if (dup) {
      throw new HttpError(
        409,
        dup.username === username ? 'Username already taken' : 'Email already in use',
        'IAM_006',
      );
    }

    // No temp password is communicated. The account is created with an
    // unusable random password; the employee sets their own via the emailed
    // set-password link before they can log in.
    const placeholderPassword = await hashPassword(generateRandomPassword(24));

    const session = await mongoose.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const [user] = await User.create(
          [
            {
              username,
              email,
              password: placeholderPassword,
              employeeId: employee._id,
              status: 'active',
              mustChangePassword: false,
              failedLoginAttempts: 0,
            },
          ],
          { session },
        );

        await Employee.updateOne({ _id: employee._id }, { userId: user._id }, { session });

        await UserRole.create(
          [{ userId: user._id, roleId: employeeRole._id, assignedAt: new Date() }],
          { session },
        );

        await AuditLog.create(
          [
            {
              userId: new Types.ObjectId(hrUserId),
              resource: 'user',
              action: 'create',
              resourceId: user._id,
              changes: { provisionedFor: employee._id.toString() },
              timestamp: new Date(),
            },
          ],
          { session },
        );

        return user;
      });

      eventBus.emit('employee.granted-login', {
        userId: result._id.toString(),
        employeeId: employee._id.toString(),
        username,
        sendTo: dto.sendEmail ? email : undefined,
      });

      log.info({ employeeId, userId: result._id }, 'login granted to employee');

      return {
        userId: result._id.toString(),
        username,
        linkSentTo: dto.sendEmail ? email : null,
      };
    } finally {
      await session.endSession();
    }
  },

  /**
   * Re-provision an existing account: optionally change username/email, then
   * regenerate the placeholder password and re-send the activation invite.
   */
  async reprovision(
    employee: EmployeeDoc,
    dto: GrantLoginDto,
    email: string,
    hrUserId: string,
  ): Promise<GrantResult> {
    const user = await User.findById(employee.userId);
    if (!user) {
      // Orphaned link — clear it and fall back to a fresh provision.
      await Employee.updateOne({ _id: employee._id }, { $unset: { userId: 1 } });
      employee.userId = undefined;
      return this.grantLogin(employee._id.toString(), dto, hrUserId);
    }

    const nextUsername = (dto.username ?? user.username).trim();
    const dup = await User.findOne({
      _id: { $ne: user._id },
      $or: [{ username: nextUsername }, { email }],
    });
    if (dup) {
      throw new HttpError(
        409,
        dup.username === nextUsername ? 'Username already taken' : 'Email already in use',
        'IAM_006',
      );
    }

    user.username = nextUsername;
    user.email = email;
    // Regenerate the unusable placeholder; the employee sets a new one via the link.
    user.password = await hashPassword(generateRandomPassword(24));
    user.mustChangePassword = false;
    user.failedLoginAttempts = 0;
    if (user.status === 'locked') user.status = 'active';
    await user.save();

    await AuditLog.create({
      userId: new Types.ObjectId(hrUserId),
      resource: 'user',
      action: 'update',
      resourceId: user._id,
      changes: { reprovisioned: true, username: nextUsername, email },
      timestamp: new Date(),
    });

    eventBus.emit('employee.granted-login', {
      userId: user._id.toString(),
      employeeId: employee._id.toString(),
      username: nextUsername,
      sendTo: dto.sendEmail ? email : undefined,
    });

    log.info({ employeeId: employee._id.toString(), userId: user._id }, 'account re-provisioned');

    return {
      userId: user._id.toString(),
      username: nextUsername,
      linkSentTo: dto.sendEmail ? email : null,
    };
  },
};
