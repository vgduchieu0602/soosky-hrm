import mongoose, { Types } from 'mongoose';
import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { parsePagination, buildMeta, parseSort } from '@shared/utils/pagination.util';

import { Employee } from '@shared/models/employee.model';
import { EmployeeProfile } from '@shared/models/employee-profile.model';
import { EmployeeContact } from '@shared/models/employee-contact.model';
import { EmployeeDocumentModel } from '@shared/models/employee-document.model';
import { EmployeeBankAccount } from '@shared/models/employee-bank-account.model';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';
import { EmployeeAsset } from '@shared/models/employee-asset.model';
import { EmployeeHistory } from '@shared/models/employee-history.model';
import { User } from '@shared/models/user.model';
import { UserRole } from '@shared/models/user-role.model';
import { Department } from '@shared/models/department.model';
import { Position } from '@shared/models/position.model';
import { CompanyConfig } from '@shared/models/company-config.model';
import { LeaveBalance } from '@shared/models/leave-balance.model';

import { employeeRepository } from '@features/employee/repositories/employee.repository';
import { employeeProfileRepository } from '@features/employee/repositories/employee-profile.repository';
import { employeeHistoryService } from '@features/employee/services/employee-history.service';
import { auditService } from '@features/iam/services/audit.service';

import type { CreateEmployeeDto } from '@features/employee/dto/create-employee.dto';
import type { UpdateEmployeeDto } from '@features/employee/dto/update-employee.dto';
import type { UpdateProfileDto } from '@features/employee/dto/update-profile.dto';
import type { TerminateEmployeeDto } from '@features/employee/dto/sub-resource.dto';

const log = logger.child({ feature: 'employee', module: 'employee' });

export interface ListEmployeesQuery {
  page?: string | number;
  limit?: string | number;
  sort?: string;
  departmentId?: string;
  status?: string;
  employeeType?: string;
  managerId?: string;
  q?: string;
}

export const employeeService = {
  async create(input: CreateEmployeeDto, auditUserId: string) {
    const [dept, position] = await Promise.all([
      Department.findById(input.departmentId).lean(),
      Position.findById(input.positionId).lean(),
    ]);
    if (!dept) throw new HttpError(404, 'Department not found', 'ORG_001');
    if (!position) throw new HttpError(404, 'Position not found', 'ORG_001');

    const codeExists = await employeeRepository.findByCode(input.employeeCode);
    if (codeExists) throw new HttpError(409, 'Employee code already exists', 'EMP_002');

    const session = await mongoose.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const [employee] = await Employee.create(
          [
            {
              employeeCode: input.employeeCode.trim(),
              fingerprintId: input.fingerprintId?.trim() || null,
              departmentId: new Types.ObjectId(input.departmentId),
              positionId: new Types.ObjectId(input.positionId),
              managerId: input.managerId ? new Types.ObjectId(input.managerId) : null,
              shiftId: input.shiftId ? new Types.ObjectId(input.shiftId) : null,
              hireDate: input.hireDate,
              employeeType: input.employeeType,
              salaryZone: input.salaryZone,
              status: 'onboarding',
              userId: null,
            },
          ],
          { session },
        );

        await EmployeeProfile.create(
          [
            {
              employeeId: employee._id,
              firstName: input.profile.firstName,
              middleName: input.profile.middleName,
              lastName: input.profile.lastName,
              dateOfBirth: input.profile.dateOfBirth,
              gender: input.profile.gender ?? 'undisclosed',
              nationality: input.profile.nationality ?? 'VN',
              maritalStatus: input.profile.maritalStatus ?? 'single',
              email: input.profile.email,
              workEmail: input.profile.workEmail,
              phone: input.profile.phone,
              address: input.profile.address,
            },
          ],
          { session },
        );

        await employeeHistoryService.record({
          employeeId: employee._id.toString(),
          eventType: 'hired',
          toValue: { hireDate: input.hireDate, departmentId: input.departmentId },
          note: 'Gia nhập Soosky',
          createdBy: auditUserId,
          effectiveDate: input.hireDate,
        });

        return employee;
      });

      await auditService.record({
        userId: auditUserId,
        resource: 'employee',
        action: 'create',
        resourceId: result._id.toString(),
        changes: { employeeCode: result.employeeCode },
      });

      log.info({ employeeId: result._id }, 'employee created');
      await seedLeaveBalances(result._id).catch((err) =>
        log.error({ err, employeeId: result._id }, 'failed to seed leave balances'),
      );
      return result.toJSON();
    } finally {
      await session.endSession();
    }
  },

  async list(query: ListEmployeesQuery) {
    const { page, limit } = parsePagination({ page: query.page, limit: query.limit });
    const sort = parseSort(query.sort);
    const { items, total } = await employeeRepository.paginate({
      page,
      limit,
      sort,
      filter: {
        departmentId: query.departmentId,
        status: query.status,
        employeeType: query.employeeType,
        managerId: query.managerId,
        q: query.q,
      },
    });
    return { items, meta: buildMeta(page, limit, total) };
  },

  async findById(id: string) {
    const employee = await employeeRepository.findByIdPopulated(id);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');
    const profile = await employeeProfileRepository.findByEmployeeId(id);
    return { ...employee.toJSON(), profile: profile?.toJSON() ?? null };
  },

  async findMine(userId: string) {
    const employee = await Employee.findOne({ userId });
    if (!employee) throw new HttpError(404, 'Employee record not found for current user', 'EMP_001');
    const profile = await employeeProfileRepository.findByEmployeeId(employee._id.toString());
    return { ...employee.toJSON(), profile: profile?.toJSON() ?? null };
  },

  async update(id: string, input: UpdateEmployeeDto, auditUserId: string) {
    const before = await employeeRepository.findById(id);
    if (!before) throw new HttpError(404, 'Employee not found', 'EMP_001');

    if (input.departmentId) {
      const exists = await Department.findById(input.departmentId).lean();
      if (!exists) throw new HttpError(404, 'Department not found', 'ORG_001');
    }
    if (input.positionId) {
      const exists = await Position.findById(input.positionId).lean();
      if (!exists) throw new HttpError(404, 'Position not found', 'ORG_001');
    }
    // Correcting the employee code / fingerprint id — enforce uniqueness.
    if (input.employeeCode && input.employeeCode !== before.employeeCode) {
      const dup = await employeeRepository.findByCode(input.employeeCode);
      if (dup && dup._id.toString() !== id) throw new HttpError(409, 'Mã nhân viên đã tồn tại', 'EMP_002');
    }
    if (input.fingerprintId) {
      const dupFp = await Employee.findOne({ fingerprintId: input.fingerprintId, _id: { $ne: id } })
        .select('_id')
        .lean();
      if (dupFp) throw new HttpError(409, 'Mã vân tay đã tồn tại', 'EMP_002');
    }

    const patch = toObjectIdFields(input);
    const updated = await employeeRepository.updateById(id, patch);
    if (!updated) throw new HttpError(404, 'Employee not found', 'EMP_001');

    if (input.departmentId && input.departmentId !== before.departmentId.toString()) {
      await employeeHistoryService.record({
        employeeId: id,
        eventType: 'transfer',
        fromValue: { departmentId: before.departmentId.toString() },
        toValue: { departmentId: input.departmentId },
        createdBy: auditUserId,
      });
    }

    // Non-department work changes (position / manager / type / salary zone) are
    // logged as a generic info update so the timeline reflects them too.
    const beforePosition = before.positionId?.toString();
    const beforeManager = before.managerId ? before.managerId.toString() : null;
    const workChanged =
      (input.positionId !== undefined && input.positionId !== beforePosition) ||
      (input.managerId !== undefined && (input.managerId ?? null) !== beforeManager) ||
      (input.employeeType !== undefined && input.employeeType !== before.employeeType) ||
      (input.salaryZone !== undefined && input.salaryZone !== before.salaryZone);
    if (workChanged) {
      await employeeHistoryService.record({
        employeeId: id,
        eventType: 'info_update',
        toValue: {
          positionId: input.positionId,
          managerId: input.managerId,
          employeeType: input.employeeType,
          salaryZone: input.salaryZone,
        },
        note: 'Cập nhật thông tin công việc',
        createdBy: auditUserId,
      });
    }

    await auditService.record({
      userId: auditUserId,
      resource: 'employee',
      action: 'update',
      resourceId: id,
      changes: input as Record<string, unknown>,
    });

    log.info({ employeeId: id }, 'employee updated');
    return updated.toJSON();
  },

  async updateProfile(employeeId: string, input: UpdateProfileDto, auditUserId: string) {
    const employee = await employeeRepository.findById(employeeId);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');

    const profile = await employeeProfileRepository.upsertByEmployeeId(employeeId, input);

    // Record the personal-info change on the employee timeline.
    const changedFields = Object.keys(input).filter((k) => k !== 'avatarUrl' && k !== 'avatarId');
    if (changedFields.length > 0) {
      await employeeHistoryService.record({
        employeeId,
        eventType: 'info_update',
        toValue: input as Record<string, unknown>,
        note: 'Cập nhật thông tin cá nhân',
        createdBy: auditUserId,
      });
    }

    await auditService.record({
      userId: auditUserId,
      resource: 'employeeProfile',
      action: 'update',
      resourceId: employeeId,
      changes: input as Record<string, unknown>,
    });
    return profile.toJSON();
  },

  async terminate(id: string, input: TerminateEmployeeDto, auditUserId: string) {
    const employee = await employeeRepository.findById(id);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');
    if (employee.status === 'terminated') {
      throw new HttpError(409, 'Employee already terminated', 'EMP_004');
    }

    const updated = await employeeRepository.updateById(id, {
      status: 'terminated',
      terminationDate: input.terminationDate,
    });

    await employeeHistoryService.record({
      employeeId: id,
      eventType: 'terminated',
      fromValue: { status: employee.status },
      toValue: { status: 'terminated', terminationDate: input.terminationDate },
      note: input.reason,
      createdBy: auditUserId,
      effectiveDate: input.terminationDate,
    });

    await auditService.record({
      userId: auditUserId,
      resource: 'employee',
      action: 'update',
      resourceId: id,
      changes: { status: 'terminated', terminationDate: input.terminationDate },
    });

    log.info({ employeeId: id }, 'employee terminated');
    return updated?.toJSON();
  },

  /**
   * Bulk off-boarding: terminate many employees with one date/reason.
   * Each id is processed independently — already-terminated or missing ids are
   * skipped and reported, never aborting the rest.
   */
  async terminateMany(ids: string[], input: TerminateEmployeeDto, auditUserId: string) {
    const unique = [...new Set(ids)];
    let terminated = 0;
    const skipped: { id: string; reason: string }[] = [];
    for (const id of unique) {
      try {
        await this.terminate(id, input, auditUserId);
        terminated += 1;
      } catch (e) {
        skipped.push({ id, reason: e instanceof HttpError ? e.message : 'error' });
      }
    }
    log.info({ requested: unique.length, terminated, skipped: skipped.length }, 'employees bulk-terminated');
    return { terminated, skipped };
  },

  /**
   * Hard-delete an employee and all owned records (profile, contacts, documents,
   * bank accounts, contracts, assets, history). If a login account is linked, it
   * is removed too (along with its role assignments). Use `terminate` for the
   * normal off-boarding flow — this is for removing erroneously-created records.
   */
  async remove(id: string, auditUserId: string) {
    const employee = await employeeRepository.findById(id);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');

    const employeeObjId = new Types.ObjectId(id);
    const linkedUserId = employee.userId ?? null;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // MongoDB does not allow concurrent operations on the same transaction
        // session — they must run sequentially, otherwise the driver throws
        // "Cannot run multiple operations simultaneously on the same session".
        await EmployeeProfile.deleteOne({ employeeId: employeeObjId }, { session });
        await EmployeeContact.deleteMany({ employeeId: employeeObjId }, { session });
        await EmployeeDocumentModel.deleteMany({ employeeId: employeeObjId }, { session });
        await EmployeeBankAccount.deleteMany({ employeeId: employeeObjId }, { session });
        await EmployeeContractModel.deleteMany({ employeeId: employeeObjId }, { session });
        await EmployeeAsset.deleteMany({ employeeId: employeeObjId }, { session });
        await EmployeeHistory.deleteMany({ employeeId: employeeObjId }, { session });

        if (linkedUserId) {
          await UserRole.deleteMany({ userId: linkedUserId }, { session });
          await User.deleteOne({ _id: linkedUserId }, { session });
        }

        await Employee.deleteOne({ _id: employeeObjId }, { session });
      });

      await auditService.record({
        userId: auditUserId,
        resource: 'employee',
        action: 'delete',
        resourceId: id,
        changes: { employeeCode: employee.employeeCode, hadAccount: Boolean(linkedUserId) },
      });

      log.info({ employeeId: id }, 'employee deleted (cascade)');
      return { id, deleted: true };
    } finally {
      await session.endSession();
    }
  },

  async exportXlsx(query: ListEmployeesQuery): Promise<Buffer> {
    const sort = parseSort(query.sort);
    const { items } = await employeeRepository.paginate({
      page: 1,
      limit: 5000,
      sort,
      filter: {
        departmentId: query.departmentId,
        status: query.status,
        employeeType: query.employeeType,
        managerId: query.managerId,
        q: query.q,
      },
    });
    return buildWorkbook(items as ExportRow[]);
  },

  async stats() {
    const [byStatus, byDept] = await Promise.all([
      employeeRepository.countByStatus(),
      employeeRepository.countByDepartment(),
    ]);
    const total = byStatus.reduce((s, x) => s + x.count, 0);
    const map = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));
    return {
      total,
      active: map.active ?? 0,
      onboarding: map.onboarding ?? 0,
      onLeave: map.on_leave ?? 0,
      terminated: map.terminated ?? 0,
      byDepartment: byDept.map((d) => ({ departmentId: d._id.toString(), count: d.count })),
    };
  },
};

interface ExportRow {
  employeeCode?: string;
  fingerprintId?: string | null;
  departmentId?: { name?: string } | null;
  positionId?: { title?: string } | null;
  managerId?: { profile?: { firstName?: string; middleName?: string; lastName?: string }; employeeCode?: string } | null;
  employeeType?: string;
  status?: string;
  hireDate?: Date | string | null;
  profile?: { firstName?: string; middleName?: string; lastName?: string; email?: string; workEmail?: string; phone?: string } | null;
}

const TYPE_LABEL: Record<string, string> = {
  full_time: 'Toàn thời gian', part_time: 'Bán thời gian', contract: 'Hợp đồng', intern: 'Thực tập',
};
const STATUS_LABEL: Record<string, string> = {
  onboarding: 'Onboarding', active: 'Đang làm việc', on_leave: 'Đang nghỉ', terminated: 'Đã nghỉ việc',
};

const EXPORT_COLUMNS: { header: string; key: string; width: number }[] = [
  { header: 'Mã NV', key: 'code', width: 14 },
  { header: 'Mã vân tay', key: 'fingerprint', width: 13 },
  { header: 'Họ và tên', key: 'name', width: 26 },
  { header: 'Phòng ban', key: 'dept', width: 22 },
  { header: 'Chức vụ', key: 'position', width: 22 },
  { header: 'Loại HĐ', key: 'type', width: 16 },
  { header: 'Trạng thái', key: 'status', width: 16 },
  { header: 'Ngày vào', key: 'hireDate', width: 13 },
  { header: 'Email công ty', key: 'workEmail', width: 26 },
  { header: 'Email cá nhân', key: 'email', width: 26 },
  { header: 'Điện thoại', key: 'phone', width: 16 },
];

async function buildWorkbook(rows: ExportRow[]): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Soosky HRM';
  const ws = wb.addWorksheet('Nhân viên', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = EXPORT_COLUMNS;

  for (const r of rows) {
    const fullName = [r.profile?.lastName, r.profile?.middleName, r.profile?.firstName]
      .filter(Boolean)
      .join(' ');
    ws.addRow({
      code: r.employeeCode ?? '',
      fingerprint: r.fingerprintId ?? '',
      name: fullName || r.employeeCode || '',
      dept: r.departmentId?.name ?? '',
      position: r.positionId?.title ?? '',
      type: r.employeeType ? TYPE_LABEL[r.employeeType] ?? r.employeeType : '',
      status: r.status ? STATUS_LABEL[r.status] ?? r.status : '',
      hireDate: r.hireDate ? new Date(r.hireDate).toISOString().slice(0, 10) : '',
      workEmail: r.profile?.workEmail ?? '',
      email: r.profile?.email ?? '',
      phone: r.profile?.phone ?? '',
    });
  }

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5C4' } };
  header.alignment = { vertical: 'middle' };
  header.height = 20;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: EXPORT_COLUMNS.length } };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

function toObjectIdFields(input: UpdateEmployeeDto): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  for (const key of ['departmentId', 'positionId', 'managerId', 'shiftId'] as const) {
    const v = input[key];
    if (typeof v === 'string') out[key] = new Types.ObjectId(v);
    else if (v === null) out[key] = null;
  }
  return out;
}

/** Seed this year's leave balances from the company default quotas (best-effort). */
async function seedLeaveBalances(employeeId: Types.ObjectId): Promise<void> {
  const cfg = await CompanyConfig.findOne({ key: 'global' }).select('leaveQuotas').lean();
  const quotas = (cfg?.leaveQuotas ?? {}) as Record<string, number>;
  const year = new Date().getUTCFullYear();
  const docs = Object.entries(quotas)
    .filter(([, v]) => Number(v) > 0)
    .map(([leaveType, entitled]) => ({ employeeId, leaveType, year, entitled: Number(entitled), used: 0 }));
  if (docs.length === 0) return;
  await LeaveBalance.insertMany(docs, { ordered: false }).catch(() => undefined);
}
