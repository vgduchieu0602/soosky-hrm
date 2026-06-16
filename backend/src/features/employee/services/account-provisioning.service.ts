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
import { Employee } from '@shared/models/employee.model';
import { EmployeeProfile } from '@shared/models/employee-profile.model';
import { AuditLog } from '@shared/models/audit-log.model';

import type { GrantLoginDto } from '@features/employee/dto/grant-login.dto';

const log = logger.child({ feature: 'employee', module: 'account-provisioning' });

const EMPLOYEE_ROLE_NAME = 'employee';

function deriveUsername(email?: string, employeeCode?: string): string {
  if (email) return email.split('@')[0]!.toLowerCase();
  if (employeeCode) return employeeCode.toLowerCase().replace(/[^a-z0-9.]+/g, '.');
  return `user.${randomBytes(3).toString('hex')}`;
}

export const accountProvisioningService = {
  /**
   * Provision a user account for an existing employee. Atomic across:
   *   users, employees.userId, userRoles, auditLogs.
   * Emits `employee.granted-login` so the email worker can send temp password.
   */
  async grantLogin(employeeId: string, dto: GrantLoginDto, hrUserId: string) {
    const employee = await Employee.findById(employeeId);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');
    if (employee.userId) throw new HttpError(409, 'Employee already has a login account', 'EMP_003');

    const profile = await EmployeeProfile.findOne({ employeeId: employee._id });
    if (!profile?.email) {
      throw new HttpError(
        400,
        'Cannot grant login: employee has no personal email on profile',
        'EMP_008',
      );
    }

    const username = (dto.username ?? deriveUsername(profile.email, employee.employeeCode)).trim();

    const employeeRole = await Role.findOne({ name: EMPLOYEE_ROLE_NAME });
    if (!employeeRole) {
      throw new HttpError(500, "System role 'employee' is missing", 'IAM_009');
    }

    const dup = await User.findOne({ $or: [{ username }, { email: profile.email }] });
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
              email: profile.email,
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
        sendTo: dto.sendEmail ? profile.email : undefined,
      });

      log.info({ employeeId, userId: result._id }, 'login granted to employee');

      return {
        userId: result._id.toString(),
        username,
        linkSentTo: dto.sendEmail ? profile.email : null,
      };
    } finally {
      await session.endSession();
    }
  },
};
