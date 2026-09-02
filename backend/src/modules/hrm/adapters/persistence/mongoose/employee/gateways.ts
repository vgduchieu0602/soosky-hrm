import { Types, type ClientSession, type PipelineStage } from 'mongoose';

import { Employee } from '@modules/hrm/adapters/persistence/mongoose/models/employee.model';
import { EmployeeProfile } from '@modules/hrm/adapters/persistence/mongoose/models/employee-profile.model';
import { EmployeeContact } from '@modules/hrm/adapters/persistence/mongoose/models/employee-contact.model';
import { EmployeeBankAccount } from '@modules/hrm/adapters/persistence/mongoose/models/employee-bank-account.model';
import { EmployeeDocumentModel } from '@modules/hrm/adapters/persistence/mongoose/models/employee-document.model';
import { EmployeeContractModel } from '@modules/hrm/adapters/persistence/mongoose/models/employee-contract.model';
import { EmployeeAsset } from '@modules/hrm/adapters/persistence/mongoose/models/employee-asset.model';
import { EmployeeHistory } from '@modules/hrm/adapters/persistence/mongoose/models/employee-history.model';
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

import { sessionRepository } from '@modules/auth';
import { iamDirectory } from '@modules/iam';
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

export class MongooseAccountGateway implements AccountGateway {
  findEmployeeRoleId(): Promise<string | null> {
    return iamDirectory.findRoleIdByName('employee');
  }
  findRoleIdByName(name: string): Promise<string | null> {
    return iamDirectory.findRoleIdByName(name);
  }
  getUser(userId: Id): Promise<UserRec | null> {
    return iamDirectory.getUser(userId);
  }
  getUserByEmployeeId(employeeId: Id): Promise<UserRec | null> {
    return iamDirectory.getUserByEmployeeId(employeeId);
  }
  findUserConflict(username: string, email: string, exceptUserId?: Id): Promise<{ username: string } | null> {
    return iamDirectory.findUserConflict(username, email, exceptUserId);
  }
  roleNameOf(userId: Id): Promise<string> {
    return iamDirectory.roleNameOf(userId);
  }
  createUser(
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
    return iamDirectory.createUser(data, tx);
  }
  assignRole(userId: Id, roleId: Id, tx: Tx): Promise<void> {
    return iamDirectory.assignRole(userId, roleId, tx);
  }
  replaceRoles(userId: Id, roleId: Id, tx: Tx): Promise<void> {
    return iamDirectory.replaceRoles(userId, roleId, tx);
  }
  updateUserAccount(userId: Id, patch: UpdateUserAccountPatch, tx?: Tx): Promise<void> {
    return iamDirectory.updateUserAccount(userId, patch, tx);
  }
  writeUserAudit(
    entry: { userId: string; resource: string; action: string; resourceId: string; changes?: Record<string, unknown> },
    tx?: Tx,
  ): Promise<void> {
    return iamDirectory.writeUserAudit(entry, tx);
  }
  revokeUserSessions(userId: Id): Promise<void> {
    return sessionRepository.revokeAllForUser(userId);
  }
  revokeAllSessions(userId: Id, tx: Tx): Promise<void> {
    return sessionRepository.revokeAllForUser(userId, tx);
  }
  disableUser(userId: Id, tx: Tx): Promise<void> {
    return iamDirectory.disableUser(userId, tx);
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
      await iamDirectory.deleteUserWithRoles(linkedUserId, tx);
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
