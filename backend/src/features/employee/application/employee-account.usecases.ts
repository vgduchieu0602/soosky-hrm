import { logger } from '@infra/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { isValidObjectId } from '@features/employee/domain/employee-rules';
import type { UpdateAccountDto } from '@features/employee/dto/account.dto';
import type {
  EmployeeRepository,
  AccountGateway,
  AuditPort,
  EventsPort,
  UnitOfWork,
  UserRec,
} from '@features/employee/domain/ports';

const log = logger.child({ feature: 'employee', module: 'account' });

export class EmployeeAccountUseCases {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly accounts: AccountGateway,
    private readonly audit: AuditPort,
    private readonly events: EventsPort,
    private readonly uow: UnitOfWork,
  ) {}

  private async loadUserForEmployee(employeeId: string): Promise<{ user: UserRec }> {
    if (!isValidObjectId(employeeId)) {
      throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    }
    const employee = await this.employees.findById(employeeId);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');
    if (!employee.userId) {
      throw new HttpError(409, 'Employee has no login account', 'EMP_010');
    }
    const user = await this.accounts.getUser(String(employee.userId));
    if (!user) throw new HttpError(404, 'Linked user account not found', 'IAM_002');
    return { user };
  }

  /** Account summary for the Account tab. Never throws for "no account" — returns hasAccount:false. */
  async getAccount(employeeId: string) {
    if (!isValidObjectId(employeeId)) {
      throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    }
    const employee = await this.employees.findById(employeeId);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');

    let user = employee.userId ? await this.accounts.getUser(String(employee.userId)) : null;
    if (!user) {
      user = await this.accounts.getUserByEmployeeId(String(employee._id));
      if (user && String(employee.userId) !== user.id) {
        await this.employees.linkUser(String(employee._id), user.id);
        log.info({ employeeId, userId: user.id }, 'healed employee.userId from reverse link');
      }
    }
    if (!user) return { hasAccount: false as const };

    return {
      hasAccount: true as const,
      userId: user.id,
      username: user.username,
      email: user.email,
      role: await this.accounts.roleNameOf(user.id),
      status: user.status,
      lastLoginAt: user.lastLoginAt ?? null,
      mustChangePassword: user.mustChangePassword,
      mfaEnabled: false,
    };
  }

  /** Email the employee a fresh "set new password" link (no password is set here). */
  async resetPassword(employeeId: string, auditUserId: string) {
    const { user } = await this.loadUserForEmployee(employeeId);
    await this.accounts.updateUserAccount(user.id, { failedLoginAttempts: 0, activateIfLocked: true });

    await this.audit.record({
      userId: auditUserId,
      resource: 'user',
      action: 'update',
      resourceId: user.id,
      changes: { passwordResetLinkSent: true },
    });

    this.events.passwordReset({
      userId: user.id,
      employeeId,
      username: user.username,
      sendTo: user.email,
    });

    log.info({ employeeId, userId: user.id }, 'account password-reset link sent');
    return { userId: user.id, linkSentTo: user.email };
  }

  /** Re-send the activation invite (a fresh set-password link). */
  async resendInvite(employeeId: string, auditUserId: string) {
    const { user } = await this.loadUserForEmployee(employeeId);

    await this.audit.record({
      userId: auditUserId,
      resource: 'user',
      action: 'update',
      resourceId: user.id,
      changes: { inviteResent: true },
    });

    this.events.inviteResent({
      userId: user.id,
      employeeId,
      username: user.username,
      sendTo: user.email,
    });

    log.info({ employeeId, userId: user.id }, 'account invite resent');
    return { userId: user.id, linkSentTo: user.email };
  }

  /** Enable/disable login and/or change the assigned role. */
  async update(employeeId: string, input: UpdateAccountDto, auditUserId: string) {
    const { user } = await this.loadUserForEmployee(employeeId);

    if (input.status) {
      await this.accounts.updateUserAccount(user.id, { status: input.status });
      if (input.status === 'disabled') {
        await this.accounts.revokeUserSessions(user.id);
      }
    }

    if (input.role) {
      const roleId = await this.accounts.findRoleIdByName(input.role);
      if (!roleId) throw new HttpError(404, `Role '${input.role}' not found`, 'IAM_008');
      await this.uow.withTransaction(async (tx) => {
        await this.accounts.replaceRoles(user.id, roleId, tx);
      });
    }

    await this.audit.record({
      userId: auditUserId,
      resource: 'user',
      action: 'update',
      resourceId: user.id,
      changes: input as Record<string, unknown>,
    });

    log.info({ employeeId, userId: user.id }, 'account updated');
    return this.getAccount(employeeId);
  }
}
