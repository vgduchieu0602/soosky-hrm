import { Types, type ClientSession, type PipelineStage } from 'mongoose';

import { Employee } from '@modules/hrm/adapters/persistence/mongoose/models/employee.model';
import { EmployeeProfile } from '@modules/hrm/adapters/persistence/mongoose/models/employee-profile.model';
import { EmployeeContact } from '@modules/hrm/adapters/persistence/mongoose/models/employee-contact.model';
import { EmployeeBankAccount } from '@modules/hrm/adapters/persistence/mongoose/models/employee-bank-account.model';
import { EmployeeDocumentModel } from '@modules/hrm/adapters/persistence/mongoose/models/employee-document.model';
import { EmployeeContractModel } from '@modules/hrm/adapters/persistence/mongoose/models/employee-contract.model';
import { EmployeeAsset } from '@modules/hrm/adapters/persistence/mongoose/models/employee-asset.model';
import { EmployeeHistory } from '@modules/hrm/adapters/persistence/mongoose/models/employee-history.model';
import { User } from '@shared/models/user.model';
import { Role } from '@shared/models/role.model';
import { UserRole } from '@shared/models/user-role.model';
import { Session } from '@shared/models/session.model';
import { AuditLog } from '@shared/models/audit-log.model';
import { Department } from '@modules/hrm/adapters/persistence/mongoose/models/department.model';
import { Position } from '@modules/hrm/adapters/persistence/mongoose/models/position.model';
import { CompanyConfig } from '@modules/hrm/adapters/persistence/mongoose/models/company-config.model';
import { LeaveBalance } from '@modules/hrm/adapters/persistence/mongoose/models/leave-balance.model';
import { LeaveRequest } from '@modules/hrm/adapters/persistence/mongoose/models/leave-request.model';
import { Attendance } from '@modules/hrm/adapters/persistence/mongoose/models/attendance.model';
import { Payroll } from '@modules/hrm/adapters/persistence/mongoose/models/payroll.model';
import { MonthlyEvaluation } from '@modules/hrm/adapters/persistence/mongoose/models/monthly-evaluation.model';
import { Allowance } from '@modules/hrm/adapters/persistence/mongoose/models/allowance.model';
import { Bonus } from '@modules/hrm/adapters/persistence/mongoose/models/bonus.model';
import { Deduction } from '@modules/hrm/adapters/persistence/mongoose/models/deduction.model';
import { EmployeeTaxProfile } from '@modules/hrm/adapters/persistence/mongoose/models/employee-tax-profile.model';

import { sessionRepository } from '@features/iam/repositories/session.repository';
import { notificationService } from '@modules/hrm/adapters/container/notification';

import type { ReminderRow } from '@modules/hrm/core/employee/domain/employee-rules';
import type {
  OrganizationGateway,
  OrgRef,
  AccountGateway,
  UserRec,
  UpdateUserAccountPatch,
  LeaveSeedGateway,
  CascadeGateway,
  NotificationGateway,
  CompletenessGateway,
  ReminderRepository,
  Doc,
  Id,
  Tx,
} from '@modules/hrm/core/employee/domain/ports';

const sess = (tx?: Tx) => (tx ? (tx as ClientSession) : undefined);

export class MongooseOrganizationGateway implements OrganizationGateway {
  async findDepartment(id: Id): Promise<Doc | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return (await Department.findById(id).lean()) as Doc | null;
  }
  async findPosition(id: Id): Promise<Doc | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return (await Position.findById(id).lean()) as Doc | null;
  }
  async listDepartmentCodes(): Promise<OrgRef[]> {
    const rows = await Department.find({}).select('code name status').lean();
    return rows.map((d) => {
      const r = d as { code: string; name?: string; status?: string };
      return { _id: String(d._id), code: r.code, name: r.name ?? r.code, status: r.status ?? 'active' };
    });
  }
  async listPositionCodes(): Promise<OrgRef[]> {
    const rows = await Position.find({}).select('code title status').lean();
    return rows.map((p) => {
      const r = p as { code: string; title?: string; status?: string };
      return { _id: String(p._id), code: r.code, name: r.title ?? r.code, status: r.status ?? 'active' };
    });
  }
  async namesByIds(
    departmentIds: readonly string[],
    positionIds: readonly string[],
  ): Promise<{ departments: Record<string, string>; positions: Record<string, string> }> {
    const oids = (ids: readonly string[]) =>
      ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));

    const [depts, positions] = await Promise.all([
      departmentIds.length ? Department.find({ _id: { $in: oids(departmentIds) } }).select('name').lean() : [],
      positionIds.length ? Position.find({ _id: { $in: oids(positionIds) } }).select('title').lean() : [],
    ]);

    return {
      departments: Object.fromEntries(depts.map((d) => [String(d._id), (d as { name: string }).name])),
      positions: Object.fromEntries(positions.map((p) => [String(p._id), (p as { title: string }).title])),
    };
  }
}

function toUserRec(u: {
  _id: unknown;
  username: string;
  email: string;
  status: string;
  lastLoginAt?: Date | null;
  mustChangePassword: boolean;
}): UserRec {
  return {
    id: String(u._id),
    username: u.username,
    email: u.email,
    status: u.status,
    lastLoginAt: u.lastLoginAt ?? null,
    mustChangePassword: u.mustChangePassword,
  };
}

export class MongooseAccountGateway implements AccountGateway {
  async findEmployeeRoleId(): Promise<string | null> {
    const r = await Role.findOne({ name: 'employee' }).select('_id').lean();
    return r ? String(r._id) : null;
  }
  async findRoleIdByName(name: string): Promise<string | null> {
    const r = await Role.findOne({ name }).select('_id').lean();
    return r ? String(r._id) : null;
  }
  async getUser(userId: Id): Promise<UserRec | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    const u = await User.findById(userId).lean();
    return u ? toUserRec(u as never) : null;
  }
  async getUserByEmployeeId(employeeId: Id): Promise<UserRec | null> {
    const u = await User.findOne({ employeeId: new Types.ObjectId(employeeId) }).lean();
    return u ? toUserRec(u as never) : null;
  }
  async findUserConflict(username: string, email: string, exceptUserId?: Id): Promise<{ username: string } | null> {
    const filter: Record<string, unknown> = { $or: [{ username }, { email }] };
    if (exceptUserId) filter._id = { $ne: new Types.ObjectId(exceptUserId) };
    const dup = await User.findOne(filter).select('username').lean();
    return dup ? { username: (dup as { username: string }).username } : null;
  }
  async roleNameOf(userId: Id): Promise<string> {
    const ur = await UserRole.findOne({ userId }).select('roleId').lean();
    if (!(ur as { roleId?: unknown })?.roleId) return 'employee';
    const role = await Role.findById((ur as { roleId: unknown }).roleId).select('name').lean();
    return (role as { name?: string })?.name ?? 'employee';
  }
  async createUser(
    data: {
      username: string;
      email: string;
      password: string;
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
          password: data.password,
          employeeId: new Types.ObjectId(data.employeeId),
          status: data.status,
          mustChangePassword: data.mustChangePassword,
          failedLoginAttempts: data.failedLoginAttempts,
        },
      ] as any[],
      { session: sess(tx) },
    );
    return { id: String(user!._id) };
  }
  async assignRole(userId: Id, roleId: Id, tx: Tx): Promise<void> {
    await UserRole.create([{ userId, roleId, assignedAt: new Date() }], { session: sess(tx) });
  }
  async replaceRoles(userId: Id, roleId: Id, tx: Tx): Promise<void> {
    await UserRole.deleteMany({ userId }, { session: sess(tx) });
    await UserRole.create([{ userId, roleId, assignedAt: new Date() }], { session: sess(tx) });
  }
  async updateUserAccount(userId: Id, patch: UpdateUserAccountPatch, tx?: Tx): Promise<void> {
    const user = await User.findById(userId).session(sess(tx) ?? null);
    if (!user) return;
    if (patch.username !== undefined) user.username = patch.username;
    if (patch.email !== undefined) user.email = patch.email;
    if (patch.password !== undefined) user.password = patch.password;
    if (patch.mustChangePassword !== undefined) user.mustChangePassword = patch.mustChangePassword;
    if (patch.failedLoginAttempts !== undefined) user.failedLoginAttempts = patch.failedLoginAttempts;
    if (patch.status !== undefined) user.status = patch.status as never;
    if (patch.activateIfLocked && user.status === 'locked') user.status = 'active';
    await user.save({ session: sess(tx) });
  }
  async writeUserAudit(
    entry: { userId: string; resource: string; action: string; resourceId: string; changes?: Record<string, unknown> },
    tx?: Tx,
  ): Promise<void> {
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
  }
  async revokeUserSessions(userId: Id): Promise<void> {
    await Session.updateMany(
      { userId: new Types.ObjectId(userId), revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  }
  async revokeAllSessions(userId: Id, tx: Tx): Promise<void> {
    await sessionRepository.revokeAllForUser(userId, tx);
  }
  async disableUser(userId: Id, tx: Tx): Promise<void> {
    await User.updateOne({ _id: userId }, { $set: { status: 'disabled' } }, { session: sess(tx) });
  }
}

export class MongooseLeaveSeedGateway implements LeaveSeedGateway {
  async seedLeaveBalances(employeeId: Id): Promise<void> {
    const cfg = await CompanyConfig.findOne({ key: 'global' }).select('leaveQuotas').lean();
    const quotas = ((cfg as { leaveQuotas?: Record<string, number> })?.leaveQuotas ?? {}) as Record<string, number>;
    const year = new Date().getUTCFullYear();
    const eid = new Types.ObjectId(employeeId);
    const docs = Object.entries(quotas)
      .filter(([type, v]) => type !== 'annual' && Number(v) > 0)
      .map(([leaveType, entitled]) => ({ employeeId: eid, leaveType, year, entitled: Number(entitled), used: 0 }));
    if (docs.length === 0) return;
    await LeaveBalance.insertMany(docs, { ordered: false }).catch(() => undefined);
  }
}

export class MongooseCascadeGateway implements CascadeGateway {
  async deleteEmployeeCascade(employeeId: Id, linkedUserId: string | null, tx: Tx): Promise<void> {
    const employeeObjId = new Types.ObjectId(employeeId);
    const session = sess(tx);
    await EmployeeProfile.deleteOne({ employeeId: employeeObjId }, { session });
    await EmployeeContact.deleteMany({ employeeId: employeeObjId }, { session });
    await EmployeeDocumentModel.deleteMany({ employeeId: employeeObjId }, { session });
    await EmployeeBankAccount.deleteMany({ employeeId: employeeObjId }, { session });
    await EmployeeContractModel.deleteMany({ employeeId: employeeObjId }, { session });
    await EmployeeAsset.deleteMany({ employeeId: employeeObjId }, { session });
    await EmployeeHistory.deleteMany({ employeeId: employeeObjId }, { session });

    await Attendance.deleteMany({ employeeId: employeeObjId }, { session });
    await LeaveRequest.deleteMany({ employeeId: employeeObjId }, { session });
    await LeaveBalance.deleteMany({ employeeId: employeeObjId }, { session });
    await Payroll.deleteMany({ employeeId: employeeObjId }, { session });
    await MonthlyEvaluation.deleteMany({ employeeId: employeeObjId }, { session });
    await Allowance.deleteMany({ employeeId: employeeObjId }, { session });
    await Bonus.deleteMany({ employeeId: employeeObjId }, { session });
    await Deduction.deleteMany({ employeeId: employeeObjId }, { session });
    await EmployeeTaxProfile.deleteMany({ employeeId: employeeObjId }, { session });

    await Employee.updateMany({ managerId: employeeObjId }, { $unset: { managerId: '' } }, { session });

    if (linkedUserId) {
      await UserRole.deleteMany({ userId: new Types.ObjectId(linkedUserId) }, { session });
      await User.deleteOne({ _id: new Types.ObjectId(linkedUserId) }, { session });
    }

    await Employee.deleteOne({ _id: employeeObjId }, { session });
  }
}

export class NotificationServiceGateway implements NotificationGateway {
  userIdsByRoles(roles: string[]): Promise<string[]> {
    return notificationService.userIdsByRoles(roles);
  }
  notifyMany(
    recipients: string[],
    payload: { type: string; severity: string; title: string; message: string; link: string },
  ): Promise<void> {
    return notificationService.notifyMany(recipients, payload as Parameters<typeof notificationService.notifyMany>[1]);
  }
}

export class MongooseCompletenessGateway implements CompletenessGateway {
  async gather(employeeId: Id) {
    const employee = await Employee.findById(employeeId).select('userId').lean();
    if (!employee) return null;
    const eid = new Types.ObjectId(employeeId);
    const [profile, contacts, banks, contracts, docs] = await Promise.all([
      EmployeeProfile.findOne({ employeeId: eid }).lean(),
      EmployeeContact.countDocuments({ employeeId: eid }),
      EmployeeBankAccount.countDocuments({ employeeId: eid }),
      EmployeeContractModel.countDocuments({ employeeId: eid }),
      EmployeeDocumentModel.countDocuments({ employeeId: eid }),
    ]);
    return {
      userId: (employee as { userId?: unknown }).userId,
      profile: (profile as { dateOfBirth?: unknown; phone?: unknown; email?: unknown; address?: unknown } | null) ?? null,
      contacts,
      banks,
      contracts,
      docs,
    };
  }
}

export class MongooseReminderRepository implements ReminderRepository {
  async expiring(withinDays: number, now: Date): Promise<ReminderRow[]> {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const horizon = new Date(now.getTime() + withinDays * DAY_MS);
    const pipeline: PipelineStage[] = [
      { $match: { status: 'active', endDate: { $ne: null, $lte: horizon } } },
      { $lookup: { from: 'employees', localField: 'employeeId', foreignField: '_id', as: 'employee' } },
      { $unwind: '$employee' },
      { $match: { 'employee.status': { $ne: 'terminated' } } },
      { $lookup: { from: 'employeeProfiles', localField: 'employeeId', foreignField: 'employeeId', as: 'profile' } },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'departments', localField: 'employee.departmentId', foreignField: '_id', as: 'department' } },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      { $sort: { endDate: 1 } },
      {
        $project: {
          contractId: '$_id',
          employeeId: '$employeeId',
          employeeCode: '$employee.employeeCode',
          firstName: '$profile.firstName',
          middleName: '$profile.middleName',
          lastName: '$profile.lastName',
          departmentName: '$department.name',
          contractType: 1,
          employmentStatus: 1,
          contractNumber: 1,
          endDate: 1,
        },
      },
    ];
    return EmployeeContractModel.aggregate<ReminderRow>(pipeline);
  }
}
