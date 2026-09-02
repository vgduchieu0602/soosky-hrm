import { logger } from '@infra/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { parsePagination, buildMeta, parseSort } from '@shared/utils/pagination.util';

import type { CreateEmployeeDto } from '@modules/hrm/core/employee/dto/create-employee.dto';
import type { UpdateEmployeeDto } from '@modules/hrm/core/employee/dto/update-employee.dto';
import type { UpdateProfileDto } from '@modules/hrm/core/employee/dto/update-profile.dto';
import type { TerminateEmployeeDto } from '@modules/hrm/core/employee/dto/sub-resource.dto';
import type { HistoryUseCases } from '@modules/hrm/core/employee/app/history.usecases';
import type {
  EmployeeRepository,
  EmployeeProfileRepository,
  OrganizationGateway,
  AccountGateway,
  LeaveSeedGateway,
  CascadeGateway,
  ExportPort,
  CsvExportPort,
  AuditPort,
  UnitOfWork,
  Tx,
} from '@modules/hrm/core/employee/domain/ports';

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

export class EmployeeUseCases {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly profiles: EmployeeProfileRepository,
    private readonly org: OrganizationGateway,
    private readonly accounts: AccountGateway,
    private readonly history: HistoryUseCases,
    private readonly seed: LeaveSeedGateway,
    private readonly cascade: CascadeGateway,
    private readonly exporter: ExportPort,
    private readonly csv: CsvExportPort,
    private readonly audit: AuditPort,
    private readonly uow: UnitOfWork,
  ) {}

  /**
   * `tx` cho phép người gọi (nhập CSV) gộp nhiều lần tạo vào MỘT giao dịch; khi
   * bỏ trống, use-case tự mở giao dịch riêng như trước.
   */
  async create(input: CreateEmployeeDto, auditUserId: string, tx?: Tx) {
    const [dept, position] = await Promise.all([
      this.org.findDepartment(input.departmentId),
      this.org.findPosition(input.positionId),
    ]);
    if (!dept) throw new HttpError(404, 'Department not found', 'ORG_001');
    if (!position) throw new HttpError(404, 'Position not found', 'ORG_001');

    const codeExists = await this.employees.findByCode(input.employeeCode);
    if (codeExists) throw new HttpError(409, 'Employee code already exists', 'EMP_002');

    const work = async (tx: Tx) => {
      const employee = await this.employees.create(
        {
          employeeCode: input.employeeCode.trim(),
          fingerprintId: input.fingerprintId?.trim() || null,
          departmentId: input.departmentId,
          positionId: input.positionId,
          managerId: input.managerId ?? null,
          shiftId: input.shiftId ?? null,
          hireDate: input.hireDate,
          employeeType: input.employeeType,
          salaryZone: input.salaryZone,
        },
        tx,
      );

      const employeeId = String(employee._id);
      await this.profiles.create(
        employeeId,
        {
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
          socialInsuranceNo: input.profile.socialInsuranceNo,
          taxCode: input.profile.taxCode,
          vehiclePlate: input.profile.vehiclePlate,
        },
        tx,
      );

      await this.history.record(
        {
          employeeId,
          eventType: 'hired',
          toValue: { hireDate: input.hireDate, departmentId: input.departmentId },
          note: 'Gia nhập Soosky',
          createdBy: auditUserId,
          effectiveDate: input.hireDate,
        },
        tx,
      );

      return employee;
    };

    const result = tx ? await work(tx) : await this.uow.withTransaction(work);

    await this.audit.record({
      userId: auditUserId,
      resource: 'employee',
      action: 'create',
      resourceId: String(result._id),
      changes: { employeeCode: result.employeeCode },
    });

    log.info({ employeeId: result._id }, 'employee created');
    // Trong giao dịch của người gọi thì hoãn: seed đọc dữ liệu chưa commit sẽ sai.
    // Người gọi gieo số dư phép sau khi commit (xem `seedLeaveBalancesFor`).
    if (!tx) {
      await this.seed
        .seedLeaveBalances(String(result._id))
        .catch((err) => log.error({ err, employeeId: result._id }, 'failed to seed leave balances'));
    }
    return result;
  }

  /** Gieo số dư phép cho nhân viên vừa tạo trong một giao dịch bên ngoài. */
  async seedLeaveBalancesFor(employeeIds: readonly string[]): Promise<void> {
    for (const id of employeeIds) {
      await this.seed
        .seedLeaveBalances(id)
        .catch((err) => log.error({ err, employeeId: id }, 'failed to seed leave balances'));
    }
  }

  async list(query: ListEmployeesQuery) {
    const { page, limit } = parsePagination({ page: query.page, limit: query.limit });
    const sort = parseSort(query.sort);
    const { items, total } = await this.employees.paginate({
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
  }

  async findById(id: string) {
    const employee = await this.employees.findByIdPopulatedJson(id);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');
    const profile = await this.profiles.findByEmployeeId(id);
    return { ...employee, profile: profile ?? null };
  }

  async findMine(userId: string) {
    const employee = await this.employees.findByUserIdJson(userId);
    if (!employee) throw new HttpError(404, 'Employee record not found for current user', 'EMP_001');
    const profile = await this.profiles.findByEmployeeId(String(employee._id));
    return { ...employee, profile: profile ?? null };
  }

  async update(id: string, input: UpdateEmployeeDto, auditUserId: string, tx?: Tx) {
    const before = await this.employees.findById(id, tx);
    if (!before) throw new HttpError(404, 'Employee not found', 'EMP_001');

    if (input.departmentId) {
      const exists = await this.org.findDepartment(input.departmentId);
      if (!exists) throw new HttpError(404, 'Department not found', 'ORG_001');
    }
    if (input.positionId) {
      const exists = await this.org.findPosition(input.positionId);
      if (!exists) throw new HttpError(404, 'Position not found', 'ORG_001');
    }
    if (input.employeeCode && input.employeeCode !== before.employeeCode) {
      const dup = await this.employees.findByCode(input.employeeCode);
      if (dup && String(dup._id) !== id) throw new HttpError(409, 'Mã nhân viên đã tồn tại', 'EMP_002');
    }
    if (input.fingerprintId) {
      const dupFp = await this.employees.findOtherByFingerprint(input.fingerprintId, id);
      if (dupFp) throw new HttpError(409, 'Mã vân tay đã tồn tại', 'EMP_002');
    }

    const updated = await this.employees.updateById(id, input as Record<string, unknown>, tx);
    if (!updated) throw new HttpError(404, 'Employee not found', 'EMP_001');

    if (input.departmentId && input.departmentId !== before.departmentId.toString()) {
      await this.history.record(
        {
          employeeId: id,
          eventType: 'transfer',
          fromValue: { departmentId: before.departmentId.toString() },
          toValue: { departmentId: input.departmentId },
          createdBy: auditUserId,
        },
        tx,
      );
    }

    const beforePosition = before.positionId?.toString();
    const beforeManager = before.managerId ? before.managerId.toString() : null;
    const workChanged =
      (input.positionId !== undefined && input.positionId !== beforePosition) ||
      (input.managerId !== undefined && (input.managerId ?? null) !== beforeManager) ||
      (input.employeeType !== undefined && input.employeeType !== before.employeeType) ||
      (input.salaryZone !== undefined && input.salaryZone !== before.salaryZone);
    if (workChanged) {
      await this.history.record(
        {
          employeeId: id,
          eventType: 'info_update',
          fromValue: {
            positionId: beforePosition,
            managerId: beforeManager,
            employeeType: before.employeeType,
            salaryZone: before.salaryZone,
          },
          toValue: {
            positionId: input.positionId,
            managerId: input.managerId,
            employeeType: input.employeeType,
            salaryZone: input.salaryZone,
          },
          note: 'Cập nhật thông tin công việc',
          createdBy: auditUserId,
        },
        tx,
      );
    }

    await this.audit.record({
      userId: auditUserId,
      resource: 'employee',
      action: 'update',
      resourceId: id,
      changes: input as Record<string, unknown>,
    });

    log.info({ employeeId: id }, 'employee updated');
    return updated;
  }

  async updateProfile(employeeId: string, input: UpdateProfileDto, auditUserId: string, tx?: Tx) {
    const employee = await this.employees.findById(employeeId, tx);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');

    const profile = await this.profiles.upsertByEmployeeId(employeeId, input as Record<string, unknown>, tx);

    const changedFields = Object.keys(input).filter((k) => k !== 'avatarUrl' && k !== 'avatarId');
    if (changedFields.length > 0) {
      await this.history.record(
        {
          employeeId,
          eventType: 'info_update',
          toValue: input as Record<string, unknown>,
          note: 'Cập nhật thông tin cá nhân',
          createdBy: auditUserId,
        },
        tx,
      );
    }

    await this.audit.record({
      userId: auditUserId,
      resource: 'employeeProfile',
      action: 'update',
      resourceId: employeeId,
      changes: input as Record<string, unknown>,
    });
    return profile;
  }

  async terminate(id: string, input: TerminateEmployeeDto, auditUserId: string) {
    const employee = await this.employees.findById(id);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');
    if (employee.status === 'terminated') {
      throw new HttpError(409, 'Employee already terminated', 'EMP_004');
    }

    await this.uow.withTransaction(async (tx) => {
      await this.employees.setTerminated(id, input.terminationDate, tx);

      if (employee.userId) {
        await this.accounts.disableUser(String(employee.userId), tx);
        await this.accounts.revokeAllSessions(String(employee.userId), tx);
        await this.employees.unsetUserId(id, tx);
      }

      await this.employees.detachManager(id, tx);
    });

    const updated = await this.employees.findByIdJson(id);

    await this.history.record({
      employeeId: id,
      eventType: 'terminated',
      fromValue: { status: employee.status },
      toValue: { status: 'terminated', terminationDate: input.terminationDate },
      note: input.reason,
      createdBy: auditUserId,
      effectiveDate: input.terminationDate,
    });

    await this.audit.record({
      userId: auditUserId,
      resource: 'employee',
      action: 'update',
      resourceId: id,
      changes: { status: 'terminated', terminationDate: input.terminationDate },
    });

    log.info({ employeeId: id }, 'employee terminated');
    return updated ?? undefined;
  }

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
  }

  async remove(id: string, auditUserId: string) {
    const employee = await this.employees.findById(id);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');

    const linkedUserId = employee.userId ? String(employee.userId) : null;

    await this.uow.withTransaction(async (tx) => {
      await this.cascade.deleteEmployeeCascade(id, linkedUserId, tx);
    });

    await this.audit.record({
      userId: auditUserId,
      resource: 'employee',
      action: 'delete',
      resourceId: id,
      changes: { employeeCode: employee.employeeCode, hadAccount: Boolean(linkedUserId) },
    });

    log.info({ employeeId: id }, 'employee deleted (cascade)');
    return { id, deleted: true };
  }

  async exportXlsx(query: ListEmployeesQuery): Promise<Buffer> {
    const sort = parseSort(query.sort);
    const { items } = await this.employees.paginate({
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
    return this.exporter.export(items);
  }

  /** Trần cứng cho bản xuất — tránh một request kéo cả triệu bản ghi vào RAM. */
  private static readonly EXPORT_LIMIT = 5000;

  /**
   * Bản xuất CSV theo đúng bộ lọc HR đang xem. `includeSensitive=false` vẫn giữ
   * đủ cột nhưng để trống ô nhạy cảm (ngân hàng, lương, mã số thuế, BHXH, ngày
   * sinh, địa chỉ) — phạm vi do tầng HTTP quyết định theo vai trò.
   */
  async exportCsv(query: ListEmployeesQuery, includeSensitive = true): Promise<string> {
    const rows = await this.employees.listForExport(
      {
        departmentId: query.departmentId,
        status: query.status,
        employeeType: query.employeeType,
        managerId: query.managerId,
        q: query.q,
      },
      EmployeeUseCases.EXPORT_LIMIT,
    );
    return this.csv.export(rows, includeSensitive);
  }

  /** Tệp mẫu CSV để HR tải về điền — chỉ dòng header các cột nhập được. */
  importTemplate(): string {
    return this.csv.template();
  }

  async stats() {
    const [byStatus, byDept] = await Promise.all([
      this.employees.countByStatus(),
      this.employees.countByDepartment(),
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
  }
}
