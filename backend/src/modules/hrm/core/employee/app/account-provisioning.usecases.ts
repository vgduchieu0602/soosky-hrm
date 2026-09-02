import { logger } from '@infra/logger/logger';
import { HttpError } from '@shared/errors/http-error';

import { deriveUsername } from '@modules/hrm/core/employee/domain/employee-rules';
import type { GrantLoginDto } from '@modules/hrm/core/employee/dto/grant-login.dto';
import type {
  EmployeeRepository,
  EmployeeProfileRepository,
  AccountGateway,
  EventsPort,
  UnitOfWork,
  Doc,
} from '@modules/hrm/core/employee/domain/ports';

const log = logger.child({ feature: 'employee', module: 'account-provisioning' });

interface GrantResult {
  userId: string;
  username: string;
  linkSentTo: string | null;
}

export class AccountProvisioningUseCases {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly profiles: EmployeeProfileRepository,
    private readonly accounts: AccountGateway,
    private readonly events: EventsPort,
    private readonly uow: UnitOfWork,
  ) {}

  /**
   * Provision (or re-provision) a user account for an existing employee.
   * Atomic across users, employees.userId, userRoles, auditLogs. Emits
   * `employee.granted-login` so the email worker can send the setup link.
   */
  async grantLogin(employeeId: string, dto: GrantLoginDto, hrUserId: string): Promise<GrantResult> {
    const employee = await this.employees.findById(employeeId);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');

    const p = await this.profiles.findEmail(String(employee._id));
    const email = (dto.email ?? p.email ?? undefined)?.trim().toLowerCase();
    if (!email) {
      throw new HttpError(
        400,
        'Cannot grant login: employee has no personal email — please provide one',
        'EMP_008',
      );
    }
    if (p.exists && dto.email && p.email !== email) {
      await this.profiles.updateEmail(String(employee._id), email);
    }

    if (employee.userId) {
      return this.reprovision(employee, dto, email, hrUserId);
    }

    const username = (dto.username ?? deriveUsername(email, employee.employeeCode)).trim();

    const employeeRoleId = await this.accounts.findEmployeeRoleId();
    if (!employeeRoleId) {
      throw new HttpError(500, "System role 'employee' is missing", 'IAM_009');
    }

    const dup = await this.accounts.findUserConflict(username, email);
    if (dup) {
      throw new HttpError(
        409,
        dup.username === username ? 'Username already taken' : 'Email already in use',
        'IAM_006',
      );
    }

    const result = await this.uow.withTransaction(async (tx) => {
      const user = await this.accounts.createUser(
        {
          username,
          email,
          employeeId: String(employee._id),
          status: 'active',
          mustChangePassword: false,
          failedLoginAttempts: 0,
        },
        tx,
      );

      await this.employees.linkUser(String(employee._id), user.id, tx);
      await this.accounts.assignRole(user.id, employeeRoleId, tx);
      await this.accounts.writeUserAudit(
        {
          userId: hrUserId,
          resource: 'user',
          action: 'create',
          resourceId: user.id,
          changes: { provisionedFor: String(employee._id) },
        },
        tx,
      );

      return user;
    });

    this.events.grantedLogin({
      userId: result.id,
      employeeId: String(employee._id),
      username,
      sendTo: dto.sendEmail ? email : undefined,
    });

    log.info({ employeeId, userId: result.id }, 'login granted to employee');

    return { userId: result.id, username, linkSentTo: dto.sendEmail ? email : null };
  }

  private async reprovision(
    employee: Doc,
    dto: GrantLoginDto,
    email: string,
    hrUserId: string,
  ): Promise<GrantResult> {
    const user = await this.accounts.getUser(String(employee.userId));
    if (!user) {
      await this.employees.unlinkUser(String(employee._id));
      return this.grantLogin(String(employee._id), dto, hrUserId);
    }

    const nextUsername = (dto.username ?? user.username).trim();
    const dup = await this.accounts.findUserConflict(nextUsername, email, user.id);
    if (dup) {
      throw new HttpError(
        409,
        dup.username === nextUsername ? 'Username already taken' : 'Email already in use',
        'IAM_006',
      );
    }

    await this.accounts.updateUserAccount(user.id, {
      username: nextUsername,
      email,
      resetCredential: true,
      mustChangePassword: false,
      failedLoginAttempts: 0,
      activateIfLocked: true,
    });

    await this.accounts.writeUserAudit({
      userId: hrUserId,
      resource: 'user',
      action: 'update',
      resourceId: user.id,
      changes: { reprovisioned: true, username: nextUsername, email },
    });

    this.events.grantedLogin({
      userId: user.id,
      employeeId: String(employee._id),
      username: nextUsername,
      sendTo: dto.sendEmail ? email : undefined,
    });

    log.info({ employeeId: String(employee._id), userId: user.id }, 'account re-provisioned');

    return { userId: user.id, username: nextUsername, linkSentTo: dto.sendEmail ? email : null };
  }
}
