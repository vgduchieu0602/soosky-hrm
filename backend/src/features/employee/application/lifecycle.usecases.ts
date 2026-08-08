import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { isValidObjectId } from '@features/employee/domain/employee-rules';
import {
  MOVEMENT_EVENT,
  SEPARATION_EVENT,
  changesToHistoryValues,
  checkEffectiveDate,
  collectMovementChanges,
  isSeparated,
  statusAfterProbationCompleted,
  wouldCreateManagerCycle,
  type MovementType,
} from '@features/employee/domain/employee-lifecycle';
import type { HistoryUseCases } from '@features/employee/application/history.usecases';
import type {
  ChangeManagerDto,
  ChangePositionDto,
  ChangeSalaryDto,
  CompleteProbationDto,
  EndEmploymentDto,
  ExtendProbationDto,
  RehireDto,
  TransferDepartmentDto,
} from '@features/employee/dto/lifecycle.dto';
import type {
  AccountGateway,
  AuditPort,
  Clock,
  ContractRepository,
  Doc,
  EmployeeRepository,
  HistoryRepository,
  OrganizationGateway,
  UnitOfWork,
} from '@features/employee/domain/ports';

const log = logger.child({ feature: 'employee', module: 'lifecycle' });

/** Độ sâu tối đa khi dò vòng lặp quản lý — sơ đồ tổ chức thực tế nông hơn nhiều. */
const MAX_MANAGER_DEPTH = 50;

export interface TimelineEntry {
  _id: string;
  eventType: string;
  effectiveDate: string;
  createdAt: string | null;
  reason: string | null;
  performedBy: string | null;
  /** Diễn giải người đọc hiểu được: "Engineering → Product". */
  changes: { field: string; label: string; from: string | null; to: string | null }[];
}

const FIELD_LABEL: Record<string, string> = {
  departmentId: 'Phòng ban',
  positionId: 'Chức vụ',
  managerId: 'Quản lý',
  status: 'Trạng thái',
  employmentStatus: 'Tình trạng làm việc',
  baseSalary: 'Lương cơ bản',
  contractNumber: 'Số hợp đồng',
  contractType: 'Loại hợp đồng',
  employeeType: 'Loại nhân sự',
  hireDate: 'Ngày vào làm',
  terminationDate: 'Ngày nghỉ việc',
  probationEndDate: 'Ngày kết thúc thử việc',
  separationType: 'Hình thức nghỉ',
  lastWorkingDate: 'Ngày làm việc cuối',
  noticeDate: 'Ngày báo trước',
  salaryZone: 'Vùng lương',
};

const STATUS_LABEL: Record<string, string> = {
  onboarding: 'Đang onboarding',
  active: 'Đang làm việc',
  on_leave: 'Đang nghỉ',
  terminated: 'Đã nghỉ việc',
};

const EMPLOYMENT_LABEL: Record<string, string> = {
  probation: 'Thử việc',
  official: 'Chính thức',
  internship: 'Thực tập',
};

const SEPARATION_LABEL: Record<string, string> = {
  resignation: 'Nghỉ theo nguyện vọng',
  termination: 'Công ty chấm dứt',
};

/**
 * Vòng đời nhân viên — điều chuyển, thăng chức, đổi quản lý, thử việc, thay đổi
 * lương, nghỉ việc, tái tuyển.
 *
 * Mỗi thao tác chạy trong MỘT giao dịch: cập nhật trạng thái hiện tại + ghi một
 * bản ghi lịch sử bất biến (kèm `effectiveDate`, lý do, người thực hiện), rồi
 * ghi audit. Không thao tác nào ghi đè dữ liệu lịch sử cũ.
 */
export class EmployeeLifecycleUseCases {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly contracts: ContractRepository,
    private readonly historyRepo: HistoryRepository,
    private readonly history: HistoryUseCases,
    private readonly org: OrganizationGateway,
    private readonly accounts: AccountGateway,
    private readonly audit: AuditPort,
    private readonly clock: Clock,
    private readonly uow: UnitOfWork,
  ) {}

  // ---------------------------------------------------------------- movements

  /** Điều chuyển phòng ban (có thể kèm chức vụ / quản lý mới). */
  async transferDepartment(employeeId: string, input: TransferDepartmentDto, auditUserId: string) {
    return this._move(employeeId, 'department_transfer', {
      departmentId: input.newDepartmentId,
      positionId: input.newPositionId,
      managerId: input.newManagerId,
      effectiveDate: input.effectiveDate,
      reason: input.reason,
    }, auditUserId);
  }

  /** Đổi chức vụ hoặc thăng chức. */
  async changePosition(employeeId: string, input: ChangePositionDto, auditUserId: string) {
    return this._move(employeeId, input.changeType as MovementType, {
      positionId: input.newPositionId,
      effectiveDate: input.effectiveDate,
      reason: input.reason,
    }, auditUserId);
  }

  /** Đổi quản lý trực tiếp. */
  async changeManager(employeeId: string, input: ChangeManagerDto, auditUserId: string) {
    return this._move(employeeId, 'manager_change', {
      managerId: input.newManagerId,
      effectiveDate: input.effectiveDate,
      reason: input.reason,
    }, auditUserId);
  }

  private async _move(
    employeeId: string,
    type: MovementType,
    input: {
      departmentId?: string;
      positionId?: string;
      managerId?: string | null;
      effectiveDate: Date;
      reason: string;
    },
    auditUserId: string,
  ) {
    const employee = await this._loadActive(employeeId);
    this._assertEffectiveDate(input.effectiveDate, employee.hireDate);

    if (input.departmentId !== undefined) {
      const dept = await this.org.findDepartment(input.departmentId);
      if (!dept) throw new HttpError(404, 'Phòng ban không tồn tại', 'ORG_001');
      if (dept.status === 'archived') throw new HttpError(422, 'Phòng ban đã lưu trữ', 'EMP_010');
    }
    if (input.positionId !== undefined) {
      const position = await this.org.findPosition(input.positionId);
      if (!position) throw new HttpError(404, 'Chức vụ không tồn tại', 'ORG_005');
      if (position.status === 'archived') throw new HttpError(422, 'Chức vụ đã lưu trữ', 'EMP_010');
    }
    if (input.managerId) {
      await this._assertManagerAssignable(employeeId, input.managerId);
    }

    const changes = collectMovementChanges(employee, {
      departmentId: input.departmentId,
      positionId: input.positionId,
      managerId: input.managerId,
    });
    if (changes.length === 0) {
      throw new HttpError(422, 'Không có thay đổi nào so với hiện tại', 'EMP_011');
    }

    const patch: Record<string, unknown> = {};
    for (const c of changes) patch[c.field] = c.to;
    const { fromValue, toValue } = changesToHistoryValues(changes);

    await this.uow.withTransaction(async (tx) => {
      await this.employees.updateById(employeeId, patch, tx);
      await this.historyRepo.create(
        {
          employeeId,
          eventType: MOVEMENT_EVENT[type],
          fromValue,
          toValue,
          effectiveDate: input.effectiveDate,
          note: input.reason,
          createdBy: auditUserId,
        },
        tx,
      );
    });

    await this.audit.record({
      userId: auditUserId,
      resource: 'employee',
      action: 'update',
      resourceId: employeeId,
      changes: { movementType: type, ...toValue, effectiveDate: input.effectiveDate },
    });

    log.info({ employeeId, type }, 'employee movement recorded');
    return this.employees.findByIdJson(employeeId);
  }

  // ---------------------------------------------------------------- probation

  /**
   * Hoàn tất thử việc — hợp đồng đang hiệu lực chuyển sang `official`; nhân viên
   * còn `onboarding` thì chuyển `active`. Thông tin thử việc lấy từ hợp đồng,
   * KHÔNG nhân bản sang bảng employees.
   */
  async completeProbation(employeeId: string, input: CompleteProbationDto, auditUserId: string) {
    const employee = await this._loadActive(employeeId);
    this._assertEffectiveDate(input.effectiveDate, employee.hireDate);

    const contract = await this.contracts.findActive(employeeId);
    if (!contract) throw new HttpError(422, 'Nhân viên chưa có hợp đồng hiệu lực', 'EMP_012');
    if (contract.employmentStatus !== 'probation') {
      throw new HttpError(422, 'Hợp đồng hiện tại không ở tình trạng thử việc', 'EMP_012');
    }

    const nextStatus = statusAfterProbationCompleted(String(employee.status));

    await this.uow.withTransaction(async (tx) => {
      await this.contracts.setEmploymentStatus(String(contract._id), 'official', tx);
      if (nextStatus !== employee.status) {
        await this.employees.updateById(employeeId, { status: nextStatus }, tx);
      }
      await this.historyRepo.create(
        {
          employeeId,
          eventType: 'probation_completed',
          fromValue: { employmentStatus: 'probation', status: employee.status },
          toValue: { employmentStatus: 'official', status: nextStatus },
          effectiveDate: input.effectiveDate,
          note: input.reason,
          createdBy: auditUserId,
        },
        tx,
      );
    });

    await this.audit.record({
      userId: auditUserId,
      resource: 'employeeContract',
      action: 'update',
      resourceId: String(contract._id),
      changes: { employmentStatus: 'official', employeeStatus: nextStatus },
    });
    return this.employees.findByIdJson(employeeId);
  }

  /** Gia hạn thử việc — dời ngày kết thúc hợp đồng thử việc, giữ nguyên bản cũ trong lịch sử. */
  async extendProbation(employeeId: string, input: ExtendProbationDto, auditUserId: string) {
    const employee = await this._loadActive(employeeId);

    const contract = await this.contracts.findActive(employeeId);
    if (!contract) throw new HttpError(422, 'Nhân viên chưa có hợp đồng hiệu lực', 'EMP_012');
    if (contract.employmentStatus !== 'probation') {
      throw new HttpError(422, 'Hợp đồng hiện tại không ở tình trạng thử việc', 'EMP_012');
    }
    const oldEnd = contract.endDate ? new Date(contract.endDate as string) : null;
    if (oldEnd && input.newEndDate.getTime() <= oldEnd.getTime()) {
      throw new HttpError(422, 'Ngày kết thúc mới phải sau ngày hiện tại của hợp đồng', 'EMP_012');
    }
    this._assertEffectiveDate(input.newEndDate, employee.hireDate);

    await this.uow.withTransaction(async (tx) => {
      await this.contracts.setEndDate(String(contract._id), input.newEndDate, tx);
      await this.historyRepo.create(
        {
          employeeId,
          eventType: 'probation_extended',
          fromValue: { probationEndDate: oldEnd ? oldEnd.toISOString() : null },
          toValue: { probationEndDate: input.newEndDate.toISOString() },
          effectiveDate: input.newEndDate,
          note: input.reason,
          createdBy: auditUserId,
        },
        tx,
      );
    });

    await this.audit.record({
      userId: auditUserId,
      resource: 'employeeContract',
      action: 'update',
      resourceId: String(contract._id),
      changes: { endDate: input.newEndDate },
    });
    return this.contracts.findActive(employeeId);
  }

  // ------------------------------------------------------------------- salary

  /**
   * Thay đổi lương. Hợp đồng cũ được KẾT THÚC (không sửa số tiền trên nó) và một
   * hợp đồng mới hiệu lực từ `effectiveDate` được lập — nhờ vậy bảng lương đã
   * tính vẫn giữ ảnh chụp lương cũ, còn kỳ sau lấy mức mới.
   */
  async changeSalary(employeeId: string, input: ChangeSalaryDto, auditUserId: string) {
    const employee = await this._loadActive(employeeId);
    this._assertEffectiveDate(input.effectiveDate, employee.hireDate);

    const current = await this.contracts.findActive(employeeId);
    if (!current) throw new HttpError(422, 'Nhân viên chưa có hợp đồng hiệu lực', 'EMP_012');

    const dup = await this.contracts.findByNumber(input.contractNumber);
    if (dup) throw new HttpError(409, 'Số hợp đồng đã tồn tại', 'EMP_006');

    const oldSalary = current.baseSalary != null ? String(current.baseSalary) : '0';
    if (Number(oldSalary) === input.newBaseSalary) {
      throw new HttpError(422, 'Mức lương mới trùng mức hiện tại', 'EMP_011');
    }

    const created = await this.uow.withTransaction(async (tx) => {
      await this.contracts.endActive(employeeId, input.effectiveDate, 'expired', tx);
      const contract = await this.contracts.create(
        employeeId,
        {
          contractType: input.contractType ?? current.contractType,
          employmentStatus: input.employmentStatus ?? current.employmentStatus,
          contractNumber: input.contractNumber,
          startDate: input.effectiveDate,
          endDate: input.endDate ?? null,
          baseSalary: input.newBaseSalary,
          currency: current.currency ?? 'VND',
          status: 'active',
        },
        tx,
      );
      await this.historyRepo.create(
        {
          employeeId,
          eventType: 'salary_change',
          fromValue: { baseSalary: oldSalary, contractNumber: current.contractNumber },
          toValue: { baseSalary: String(input.newBaseSalary), contractNumber: input.contractNumber },
          effectiveDate: input.effectiveDate,
          note: input.reason,
          createdBy: auditUserId,
        },
        tx,
      );
      return contract;
    });

    await this.audit.record({
      userId: auditUserId,
      resource: 'employeeContract',
      action: 'create',
      resourceId: String(created._id),
      changes: { baseSalary: input.newBaseSalary, effectiveDate: input.effectiveDate, replaced: current.contractNumber },
    });

    log.info({ employeeId, contractId: created._id }, 'salary change recorded as new contract');
    return created;
  }

  // --------------------------------------------------------------- separation

  /**
   * Kết thúc hợp tác. Nhân viên KHÔNG bị xoá: trạng thái chuyển `terminated`,
   * hợp đồng đang hiệu lực được đóng, tài khoản đăng nhập bị vô hiệu và thu hồi
   * phiên; toàn bộ hồ sơ và lịch sử cũ giữ nguyên.
   *
   * `separationType` phân biệt nghỉ theo nguyện vọng và chấm dứt từ phía công ty
   * ở tầng SỰ KIỆN; `employees.status` vẫn chỉ có một giá trị "đã rời công ty" để
   * không phá vỡ mọi truy vấn `status != 'terminated'` của payroll/chấm công.
   */
  async endEmployment(employeeId: string, input: EndEmploymentDto, auditUserId: string) {
    const employee = await this._loadActive(employeeId);
    this._assertEffectiveDate(input.lastWorkingDate, employee.hireDate);

    await this.uow.withTransaction(async (tx) => {
      await this.employees.updateById(
        employeeId,
        { status: 'terminated', terminationDate: input.lastWorkingDate },
        tx,
      );
      await this.contracts.endActive(employeeId, input.lastWorkingDate, 'terminated', tx);

      if (employee.userId) {
        await this.accounts.disableUser(String(employee.userId), tx);
        await this.accounts.revokeAllSessions(String(employee.userId), tx);
        await this.employees.unsetUserId(employeeId, tx);
      }
      await this.employees.detachManager(employeeId, tx);

      await this.historyRepo.create(
        {
          employeeId,
          eventType: SEPARATION_EVENT[input.separationType],
          fromValue: { status: employee.status },
          toValue: {
            status: 'terminated',
            separationType: input.separationType,
            lastWorkingDate: input.lastWorkingDate.toISOString(),
            noticeDate: input.noticeDate ? input.noticeDate.toISOString() : null,
          },
          effectiveDate: input.lastWorkingDate,
          note: input.note ? `${input.reason} — ${input.note}` : input.reason,
          createdBy: auditUserId,
        },
        tx,
      );
    });

    await this.audit.record({
      userId: auditUserId,
      resource: 'employee',
      action: 'update',
      resourceId: employeeId,
      changes: {
        status: 'terminated',
        separationType: input.separationType,
        terminationDate: input.lastWorkingDate,
      },
    });

    log.info({ employeeId, separationType: input.separationType }, 'employment ended');
    return this.employees.findByIdJson(employeeId);
  }

  /**
   * Tái tuyển người đã nghỉ. Dùng lại chính bản ghi nhân viên cũ (giữ mã, hồ sơ,
   * lịch sử, hợp đồng và bảng lương cũ) và mở giai đoạn làm việc mới; KHÔNG tạo
   * nhân viên trùng.
   */
  async rehire(employeeId: string, input: RehireDto, auditUserId: string) {
    if (!isValidObjectId(employeeId)) throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    const employee = await this.employees.findById(employeeId);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');
    if (!isSeparated(String(employee.status))) {
      throw new HttpError(409, 'Nhân viên đang làm việc, không cần tái tuyển', 'EMP_013');
    }

    const [dept, position] = await Promise.all([
      this.org.findDepartment(input.departmentId),
      this.org.findPosition(input.positionId),
    ]);
    if (!dept) throw new HttpError(404, 'Phòng ban không tồn tại', 'ORG_001');
    if (dept.status === 'archived') throw new HttpError(422, 'Phòng ban đã lưu trữ', 'EMP_010');
    if (!position) throw new HttpError(404, 'Chức vụ không tồn tại', 'ORG_005');
    if (input.managerId) await this._assertManagerAssignable(employeeId, input.managerId);

    if (input.contract) {
      const dup = await this.contracts.findByNumber(input.contract.contractNumber);
      if (dup) throw new HttpError(409, 'Số hợp đồng đã tồn tại', 'EMP_006');
    }

    await this.uow.withTransaction(async (tx) => {
      await this.employees.updateById(
        employeeId,
        {
          status: 'onboarding',
          terminationDate: null,
          departmentId: input.departmentId,
          positionId: input.positionId,
          managerId: input.managerId ?? null,
          ...(input.employeeType ? { employeeType: input.employeeType } : {}),
        },
        tx,
      );

      if (input.contract) {
        await this.contracts.expireActive(employeeId, tx);
        await this.contracts.create(employeeId, { ...input.contract }, tx);
      }

      await this.historyRepo.create(
        {
          employeeId,
          eventType: 'rehired',
          fromValue: { status: employee.status, terminationDate: employee.terminationDate ?? null },
          toValue: {
            status: 'onboarding',
            hireDate: input.rehireDate.toISOString(),
            departmentId: input.departmentId,
            positionId: input.positionId,
            managerId: input.managerId ?? null,
          },
          effectiveDate: input.rehireDate,
          note: input.reason,
          createdBy: auditUserId,
        },
        tx,
      );
    });

    await this.audit.record({
      userId: auditUserId,
      resource: 'employee',
      action: 'update',
      resourceId: employeeId,
      changes: { rehired: true, rehireDate: input.rehireDate, departmentId: input.departmentId },
    });

    log.info({ employeeId }, 'employee rehired');
    return this.employees.findByIdJson(employeeId);
  }

  // ----------------------------------------------------------------- timeline

  /**
   * Dòng thời gian vòng đời — đã diễn giải sẵn (tên phòng ban/chức vụ/người thực
   * hiện) để giao diện không phải hiển thị JSON thô cho HR.
   */
  async timeline(employeeId: string): Promise<TimelineEntry[]> {
    if (!isValidObjectId(employeeId)) throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    const rows = await this.historyRepo.listByEmployeeWithActor(employeeId);

    const deptIds = new Set<string>();
    const posIds = new Set<string>();
    const managerIds = new Set<string>();
    for (const r of rows) {
      for (const bag of [r.fromValue, r.toValue] as (Record<string, unknown> | undefined)[]) {
        if (!bag) continue;
        if (typeof bag.departmentId === 'string') deptIds.add(bag.departmentId);
        if (typeof bag.positionId === 'string') posIds.add(bag.positionId);
        if (typeof bag.managerId === 'string') managerIds.add(bag.managerId);
      }
    }

    const [orgNames, managers] = await Promise.all([
      this.org.namesByIds([...deptIds], [...posIds]),
      this._managerNames([...managerIds]),
    ]);

    return rows.map((r) => this._toTimelineEntry(r, orgNames, managers));
  }

  private async _managerNames(ids: string[]): Promise<Record<string, string>> {
    if (ids.length === 0) return {};
    const rows = await this.employees.listNamesByIds(ids);
    return Object.fromEntries(rows.map((r) => [String(r.id), r.name]));
  }

  private _toTimelineEntry(
    row: Doc,
    orgNames: { departments: Record<string, string>; positions: Record<string, string> },
    managers: Record<string, string>,
  ): TimelineEntry {
    const keys = new Set<string>([
      ...Object.keys((row.fromValue ?? {}) as Record<string, unknown>),
      ...Object.keys((row.toValue ?? {}) as Record<string, unknown>),
    ]);

    const label = (field: string, value: unknown): string | null => {
      if (value === null || value === undefined || value === '') return null;
      const raw = String(value);
      if (field === 'departmentId') return orgNames.departments[raw] ?? raw;
      if (field === 'positionId') return orgNames.positions[raw] ?? raw;
      if (field === 'managerId') return managers[raw] ?? raw;
      if (field === 'status') return STATUS_LABEL[raw] ?? raw;
      if (field === 'employmentStatus') return EMPLOYMENT_LABEL[raw] ?? raw;
      if (field === 'separationType') return SEPARATION_LABEL[raw] ?? raw;
      return raw;
    };

    return {
      _id: String(row._id),
      eventType: String(row.eventType),
      effectiveDate: new Date(row.effectiveDate as string).toISOString(),
      createdAt: row.created_at ? new Date(row.created_at as string).toISOString() : null,
      reason: (row.note as string | undefined) ?? null,
      performedBy: (row.performedBy as string | undefined) ?? null,
      changes: [...keys].map((field) => ({
        field,
        label: FIELD_LABEL[field] ?? field,
        from: label(field, (row.fromValue as Record<string, unknown> | undefined)?.[field]),
        to: label(field, (row.toValue as Record<string, unknown> | undefined)?.[field]),
      })),
    };
  }

  // ------------------------------------------------------------------ helpers

  private async _loadActive(employeeId: string): Promise<Doc> {
    if (!isValidObjectId(employeeId)) throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    const employee = await this.employees.findById(employeeId);
    if (!employee) throw new HttpError(404, 'Employee not found', 'EMP_001');
    if (isSeparated(String(employee.status))) {
      throw new HttpError(409, 'Nhân viên đã nghỉ việc — dùng tái tuyển trước', 'EMP_004');
    }
    return employee;
  }

  private _assertEffectiveDate(effectiveDate: Date, hireDate?: unknown) {
    const check = checkEffectiveDate(
      effectiveDate,
      this.clock.now(),
      hireDate ? new Date(hireDate as string) : null,
    );
    if (!check.ok) throw new HttpError(422, check.reason ?? 'Ngày hiệu lực không hợp lệ', 'EMP_014');
  }

  private async _assertManagerAssignable(employeeId: string, managerId: string) {
    const manager = await this.employees.findById(managerId);
    if (!manager) throw new HttpError(404, 'Quản lý không tồn tại', 'EMP_001');
    if (isSeparated(String(manager.status))) {
      throw new HttpError(422, 'Quản lý đã nghỉ việc', 'EMP_015');
    }
    const chain = await this.employees.managerChainUpwards(managerId, MAX_MANAGER_DEPTH);
    if (wouldCreateManagerCycle(employeeId, managerId, chain)) {
      throw new HttpError(422, 'Phân công này tạo vòng lặp quản lý', 'EMP_016');
    }
  }
}
