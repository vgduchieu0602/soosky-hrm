import { logger } from '@infra/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import {
  assembleDepartments,
  buildHeadMap,
  collectSubtreeIds,
  type DeptHead,
} from '@modules/hrm/core/organization/domain/department-tree';
import type {
  AuditPort,
  Clock,
  DepartmentRepository,
  EmployeeGateway,
  EmployeeHistoryGateway,
  IdValidator,
  PositionGateway,
  UnitOfWork,
} from '@modules/hrm/core/organization/domain/ports';
import type {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  MoveDepartmentDto,
  TransferEmployeesDto,
  MergeDepartmentDto,
} from '@modules/hrm/core/organization/dto/department.dto';

const log = logger.child({ feature: 'organization', module: 'department' });

const BLOCKING_STATUSES = ['active', 'onboarding', 'on_leave'] as const;

export class DepartmentUseCases {
  constructor(
    private readonly repo: DepartmentRepository,
    private readonly employees: EmployeeGateway,
    private readonly employeeHistory: EmployeeHistoryGateway,
    private readonly positions: PositionGateway,
    private readonly audit: AuditPort,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdValidator,
  ) {}

  /** Validate a managerId refers to an active employee. Throws ORG_008 otherwise. */
  private async assertValidManager(managerId: string) {
    const emp = await this.employees.findEmployeeStatus(managerId);
    if (!emp || emp.status !== 'active') {
      throw new HttpError(409, 'Department head must be an active employee', 'ORG_008');
    }
  }

  async list(asTree = false) {
    const rows = await this.repo.findAll();
    const counts = await this.employees.headcountByDepartment();
    const countMap = new Map<string, number>(counts.map((c) => [c.departmentId, c.count]));

    const managerIds = rows.filter((d) => d.managerId).map((d) => d.managerId as string);
    let headMap = new Map<string, DeptHead>();
    if (managerIds.length) {
      const heads = await this.employees.findHeads(managerIds);
      headMap = buildHeadMap(heads);
    }

    return assembleDepartments(rows, countMap, headMap, asTree);
  }

  async findById(id: string) {
    const dept = await this.repo.findById(id);
    if (!dept) throw new HttpError(404, 'Department not found', 'ORG_001');
    const memberCount = await this.employees.countActiveInDepartment(id);
    return { ...dept, memberCount };
  }

  async create(input: CreateDepartmentDto, auditUserId: string) {
    const dup = await this.repo.findByCode(input.code);
    if (dup) throw new HttpError(409, 'Department code already exists', 'ORG_002');
    if (input.managerId) await this.assertValidManager(input.managerId);

    const dept = await this.repo.create({
      name: input.name,
      description: input.description,
      code: input.code.trim().toUpperCase(),
      parentDepartmentId: input.parentDepartmentId ?? null,
      managerId: input.managerId ?? null,
      status: 'active',
    });
    await this.audit.record({
      userId: auditUserId,
      resource: 'department',
      action: 'create',
      resourceId: String(dept._id),
    });
    log.info({ departmentId: dept._id }, 'department created');
    return dept;
  }

  async update(id: string, input: UpdateDepartmentDto, auditUserId: string) {
    if (input.parentDepartmentId === id) {
      throw new HttpError(400, 'Department cannot be its own parent', 'ORG_003');
    }
    const { parentDepartmentId, managerId, code, ...rest } = input;
    const patch: Record<string, unknown> = { ...rest };
    if (code !== undefined) {
      const normalized = code.trim().toUpperCase();
      const dup = await this.repo.findByCode(normalized);
      if (dup && String(dup._id) !== id) {
        throw new HttpError(409, 'Department code already exists', 'ORG_002');
      }
      patch.code = normalized;
    }
    if (parentDepartmentId !== undefined) {
      patch.parentDepartmentId = parentDepartmentId ?? null;
    }
    if (managerId !== undefined) {
      if (managerId) await this.assertValidManager(managerId);
      patch.managerId = managerId ?? null;
    }
    const updated = await this.repo.updateById(id, patch);
    if (!updated) throw new HttpError(404, 'Department not found', 'ORG_001');

    await this.audit.record({
      userId: auditUserId,
      resource: 'department',
      action: 'update',
      resourceId: id,
      changes: input as Record<string, unknown>,
    });
    return updated;
  }

  /** UC-06/07 — assign or remove the department head. */
  async assignHead(id: string, managerId: string | null, auditUserId: string) {
    if (managerId) await this.assertValidManager(managerId);
    const updated = await this.repo.updateById(id, { managerId: managerId ?? null });
    if (!updated) throw new HttpError(404, 'Department not found', 'ORG_001');

    await this.audit.record({
      userId: auditUserId,
      resource: 'department',
      action: 'update',
      resourceId: id,
      changes: { managerId },
    });
    log.info({ departmentId: id, managerId }, managerId ? 'head assigned' : 'head removed');
    return updated;
  }

  /** UC-08 — move a department to a new parent, guarding against cycles. */
  async move(id: string, input: MoveDepartmentDto, auditUserId: string) {
    const dept = await this.repo.findById(id);
    if (!dept) throw new HttpError(404, 'Department not found', 'ORG_001');

    const { parentDepartmentId } = input;
    if (parentDepartmentId) {
      if (parentDepartmentId === id) {
        throw new HttpError(400, 'Department cannot be its own parent', 'ORG_003');
      }
      const rows = await this.repo.findAll();
      const subtree = collectSubtreeIds(rows, id);
      if (subtree.has(parentDepartmentId)) {
        throw new HttpError(409, 'Cannot move a department under its own descendant', 'ORG_009');
      }
      const parent = await this.repo.findById(parentDepartmentId);
      if (!parent) throw new HttpError(404, 'Parent department not found', 'ORG_001');
    }

    const updated = await this.repo.updateById(id, {
      parentDepartmentId: parentDepartmentId ?? null,
    });
    await this.audit.record({
      userId: auditUserId,
      resource: 'department',
      action: 'update',
      resourceId: id,
      changes: {
        moved: true,
        from: dept.parentDepartmentId ? String(dept.parentDepartmentId) : null,
        to: parentDepartmentId,
      },
    });
    log.info({ departmentId: id, parentDepartmentId }, 'department moved');
    return updated!;
  }

  /** UC-09 — bulk-transfer employees from this department to another. */
  async transferEmployees(fromId: string, input: TransferEmployeesDto, auditUserId: string) {
    const { targetDepartmentId, employeeIds } = input;
    if (targetDepartmentId === fromId) {
      throw new HttpError(400, 'Source and target department must differ', 'ORG_010');
    }
    const [from, target] = await Promise.all([
      this.repo.findById(fromId),
      this.repo.findById(targetDepartmentId),
    ]);
    if (!from) throw new HttpError(404, 'Department not found', 'ORG_001');
    if (!target) throw new HttpError(404, 'Target department not found', 'ORG_001');

    const ids = await this.employees.findTransferableIds(fromId, employeeIds);
    if (ids.length === 0) return { transferred: 0 };

    const now = this.clock.now();
    await this.uow.withTransaction(async (tx) => {
      await this.employees.moveEmployees(ids, targetDepartmentId, tx);
      await this.employeeHistory.recordTransfers(
        ids.map((employeeId) => ({
          employeeId,
          fromDepartmentId: fromId,
          toDepartmentId: targetDepartmentId,
          effectiveDate: now,
          note: `Điều chuyển ${String(from.code)} → ${String(target.code)}`,
          createdBy: auditUserId,
        })),
        tx,
      );
    });

    await this.audit.record({
      userId: auditUserId,
      resource: 'department',
      action: 'update',
      resourceId: fromId,
      changes: { transferredTo: targetDepartmentId, count: ids.length },
    });
    log.info({ fromId, targetDepartmentId, count: ids.length }, 'employees transferred');
    return { transferred: ids.length };
  }

  /** UC-10 — merge this department into a target: move employees + positions, then archive. */
  async merge(sourceId: string, input: MergeDepartmentDto, auditUserId: string) {
    const { targetDepartmentId } = input;
    if (targetDepartmentId === sourceId) {
      throw new HttpError(400, 'Source and target department must differ', 'ORG_010');
    }
    const [source, target] = await Promise.all([
      this.repo.findById(sourceId),
      this.repo.findById(targetDepartmentId),
    ]);
    if (!source) throw new HttpError(404, 'Department not found', 'ORG_001');
    if (!target) throw new HttpError(404, 'Target department not found', 'ORG_001');

    const ids = await this.employees.findTransferableIds(sourceId);
    const now = this.clock.now();

    await this.uow.withTransaction(async (tx) => {
      if (ids.length) {
        await this.employees.moveEmployees(ids, targetDepartmentId, tx);
        await this.employeeHistory.recordTransfers(
          ids.map((employeeId) => ({
            employeeId,
            fromDepartmentId: sourceId,
            toDepartmentId: targetDepartmentId,
            effectiveDate: now,
            note: `Gộp phòng ${String(source.code)} → ${String(target.code)}`,
            createdBy: auditUserId,
          })),
          tx,
        );
      }
      await this.positions.moveAll(sourceId, targetDepartmentId, tx);
      await this.repo.updateById(sourceId, { status: 'archived' }, tx);
    });

    await this.audit.record({
      userId: auditUserId,
      resource: 'department',
      action: 'delete',
      resourceId: sourceId,
      changes: { mergedInto: targetDepartmentId, movedEmployees: ids.length },
    });
    log.info({ sourceId, targetDepartmentId }, 'department merged');
    const refreshed = await this.repo.findById(sourceId);
    return refreshed!;
  }

  /** UC-11 — organization-change timeline for a department (from audit log). */
  history(id: string) {
    if (!this.ids.isValid(id)) {
      throw new HttpError(400, 'Invalid department id', 'ORG_001');
    }
    return this.audit.list({ resource: 'department', resourceId: id });
  }

  /**
   * Hard-delete a department — ONLY when nothing still references it. If any
   * employee, position or sub-department still points here, refuse with a
   * warning listing what remains so the caller clears those first.
   */
  async remove(id: string, auditUserId: string) {
    if (!this.ids.isValid(id)) {
      throw new HttpError(400, 'Invalid department id', 'ORG_001');
    }
    const [employees, positions, children] = await Promise.all([
      this.employees.countAllInDepartment(id),
      this.positions.countByDepartment(id),
      this.repo.countChildren(id),
    ]);

    if (employees > 0 || positions > 0 || children > 0) {
      const parts: string[] = [];
      if (employees > 0) parts.push(`${employees} nhân viên`);
      if (positions > 0) parts.push(`${positions} vị trí`);
      if (children > 0) parts.push(`${children} phòng ban con`);
      throw new HttpError(
        409,
        `Không thể xoá: phòng ban vẫn còn ${parts.join(', ')}. Hãy chuyển hoặc xoá các dữ liệu này trước.`,
        'ORG_DEPT_HAS_DATA',
      );
    }

    const deleted = await this.repo.deleteById(id);
    if (!deleted) throw new HttpError(404, 'Department not found', 'ORG_001');

    await this.audit.record({
      userId: auditUserId,
      resource: 'department',
      action: 'delete',
      resourceId: id,
      changes: { hardDeleted: true, name: deleted.name, code: deleted.code },
    });
    log.info({ departmentId: id }, 'department hard-deleted');
    return { id, deleted: true };
  }

  async archive(id: string, auditUserId: string) {
    const active = await this.employees.countByStatuses(id, BLOCKING_STATUSES);
    if (active > 0) {
      throw new HttpError(409, 'Cannot archive department with active employees', 'ORG_004');
    }
    const activeChildren = await this.repo.findChildren(id);
    if (activeChildren.some((c) => c.status === 'active')) {
      throw new HttpError(409, 'Cannot archive department with active sub-departments', 'ORG_011');
    }
    const updated = await this.repo.updateById(id, { status: 'archived' });
    if (!updated) throw new HttpError(404, 'Department not found', 'ORG_001');

    await this.audit.record({
      userId: auditUserId,
      resource: 'department',
      action: 'delete',
      resourceId: id,
      changes: { status: 'archived' },
    });
    return updated;
  }
}
