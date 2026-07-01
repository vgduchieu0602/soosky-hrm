import mongoose, { Types } from 'mongoose';
import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { Employee } from '@shared/models/employee.model';
import { EmployeeHistory } from '@shared/models/employee-history.model';
import { Position } from '@shared/models/position.model';
import { Department, type IDepartment } from '@shared/models/department.model';
import { departmentRepository } from '@features/organization/repositories/department.repository';
import { auditService } from '@features/iam/services/audit.service';
import type {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  MoveDepartmentDto,
  TransferEmployeesDto,
  MergeDepartmentDto,
} from '@features/organization/dto/department.dto';

const log = logger.child({ feature: 'organization', module: 'department' });

const BLOCKING_STATUSES = ['active', 'onboarding', 'on_leave'] as const;

interface DeptHead {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface DeptNode {
  id: string;
  name: string;
  code: string;
  parentDepartmentId: string | null;
  managerId: string | null;
  head: DeptHead | null;
  description?: string;
  status: string;
  headcount: number;
  children: DeptNode[];
}

/** Validate a managerId refers to an active employee. Throws ORG_008 otherwise. */
async function assertValidManager(managerId: string) {
  const emp = await Employee.findById(managerId).lean();
  if (!emp || emp.status !== 'active') {
    throw new HttpError(409, 'Department head must be an active employee', 'ORG_008');
  }
}

/** Collect the id + all descendant ids of a department (for cycle / archive checks). */
async function collectSubtreeIds(rootId: string): Promise<Set<string>> {
  const all = await departmentRepository.findAll();
  const childrenByParent = new Map<string, string[]>();
  for (const d of all) {
    const parent = d.parentDepartmentId ? d.parentDepartmentId.toString() : null;
    if (!parent) continue;
    const list = childrenByParent.get(parent) ?? [];
    list.push(d._id.toString());
    childrenByParent.set(parent, list);
  }
  const result = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (result.has(cur)) continue;
    result.add(cur);
    for (const child of childrenByParent.get(cur) ?? []) stack.push(child);
  }
  return result;
}

export const departmentService = {
  async list(asTree = false) {
    const all = await departmentRepository.findAll();
    const counts = await Employee.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { status: { $ne: 'terminated' } } },
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map<string, number>(counts.map((c) => [c._id.toString(), c.count]));

    // Resolve department heads (name + avatar) in one aggregation.
    const managerIds = all
      .filter((d) => d.managerId)
      .map((d) => d.managerId as Types.ObjectId);
    const headMap = new Map<string, DeptHead>();
    if (managerIds.length) {
      const heads = await Employee.aggregate<{
        _id: Types.ObjectId;
        firstName?: string;
        middleName?: string;
        lastName?: string;
        avatarUrl?: string;
      }>([
        { $match: { _id: { $in: managerIds }, status: { $ne: 'terminated' } } },
        {
          $lookup: {
            from: 'employeeProfiles',
            localField: '_id',
            foreignField: 'employeeId',
            as: 'profile',
          },
        },
        { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            firstName: '$profile.firstName',
            middleName: '$profile.middleName',
            lastName: '$profile.lastName',
            avatarUrl: '$profile.avatarUrl',
          },
        },
      ]);
      for (const h of heads) {
        const name = [h.lastName, h.middleName, h.firstName].filter(Boolean).join(' ').trim();
        headMap.set(h._id.toString(), { id: h._id.toString(), name, avatarUrl: h.avatarUrl });
      }
    }

    const flat: DeptNode[] = all.map((d) => ({
      id: d._id.toString(),
      name: d.name,
      code: d.code,
      parentDepartmentId: d.parentDepartmentId ? d.parentDepartmentId.toString() : null,
      managerId: d.managerId ? d.managerId.toString() : null,
      head: d.managerId ? (headMap.get(d.managerId.toString()) ?? null) : null,
      description: d.description,
      status: d.status,
      headcount: countMap.get(d._id.toString()) ?? 0,
      children: [],
    }));

    if (!asTree) return flat;

    const byId = new Map(flat.map((n) => [n.id, n]));
    const roots: DeptNode[] = [];
    for (const node of flat) {
      if (node.parentDepartmentId && byId.has(node.parentDepartmentId)) {
        byId.get(node.parentDepartmentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  },

  async findById(id: string) {
    const dept = await departmentRepository.findById(id);
    if (!dept) throw new HttpError(404, 'Department not found', 'ORG_001');
    const memberCount = await Employee.countDocuments({
      departmentId: dept._id,
      status: { $ne: 'terminated' },
    });
    return { ...dept.toJSON(), memberCount };
  },

  async create(input: CreateDepartmentDto, auditUserId: string) {
    const dup = await departmentRepository.findByCode(input.code);
    if (dup) throw new HttpError(409, 'Department code already exists', 'ORG_002');
    if (input.managerId) await assertValidManager(input.managerId);

    const dept = await departmentRepository.create({
      ...input,
      code: input.code.trim().toUpperCase(),
      parentDepartmentId: input.parentDepartmentId
        ? new Types.ObjectId(input.parentDepartmentId)
        : null,
      managerId: input.managerId ? new Types.ObjectId(input.managerId) : null,
      status: 'active',
    });
    await auditService.record({
      userId: auditUserId,
      resource: 'department',
      action: 'create',
      resourceId: dept._id.toString(),
    });
    log.info({ departmentId: dept._id }, 'department created');
    return dept.toJSON();
  },

  async update(id: string, input: UpdateDepartmentDto, auditUserId: string) {
    if (input.parentDepartmentId === id) {
      throw new HttpError(400, 'Department cannot be its own parent', 'ORG_003');
    }
    const { parentDepartmentId, managerId, code, ...rest } = input;
    const patch: Partial<IDepartment> = { ...rest };
    if (code !== undefined) {
      const normalized = code.trim().toUpperCase();
      const dup = await departmentRepository.findByCode(normalized);
      if (dup && dup._id.toString() !== id) {
        throw new HttpError(409, 'Department code already exists', 'ORG_002');
      }
      patch.code = normalized;
    }
    if (parentDepartmentId !== undefined) {
      patch.parentDepartmentId = parentDepartmentId
        ? new Types.ObjectId(parentDepartmentId)
        : null;
    }
    if (managerId !== undefined) {
      if (managerId) await assertValidManager(managerId);
      patch.managerId = managerId ? new Types.ObjectId(managerId) : null;
    }
    const updated = await departmentRepository.updateById(id, patch);
    if (!updated) throw new HttpError(404, 'Department not found', 'ORG_001');

    await auditService.record({
      userId: auditUserId,
      resource: 'department',
      action: 'update',
      resourceId: id,
      changes: input as Record<string, unknown>,
    });
    return updated.toJSON();
  },

  /** UC-06/07 — assign or remove the department head. */
  async assignHead(id: string, managerId: string | null, auditUserId: string) {
    if (managerId) await assertValidManager(managerId);
    const updated = await departmentRepository.updateById(id, {
      managerId: managerId ? new Types.ObjectId(managerId) : null,
    });
    if (!updated) throw new HttpError(404, 'Department not found', 'ORG_001');

    await auditService.record({
      userId: auditUserId,
      resource: 'department',
      action: 'update',
      resourceId: id,
      changes: { managerId },
    });
    log.info({ departmentId: id, managerId }, managerId ? 'head assigned' : 'head removed');
    return updated.toJSON();
  },

  /** UC-08 — move a department to a new parent, guarding against cycles. */
  async move(id: string, input: MoveDepartmentDto, auditUserId: string) {
    const dept = await departmentRepository.findById(id);
    if (!dept) throw new HttpError(404, 'Department not found', 'ORG_001');

    const { parentDepartmentId } = input;
    if (parentDepartmentId) {
      if (parentDepartmentId === id) {
        throw new HttpError(400, 'Department cannot be its own parent', 'ORG_003');
      }
      const subtree = await collectSubtreeIds(id);
      if (subtree.has(parentDepartmentId)) {
        throw new HttpError(409, 'Cannot move a department under its own descendant', 'ORG_009');
      }
      const parent = await departmentRepository.findById(parentDepartmentId);
      if (!parent) throw new HttpError(404, 'Parent department not found', 'ORG_001');
    }

    const updated = await departmentRepository.updateById(id, {
      parentDepartmentId: parentDepartmentId ? new Types.ObjectId(parentDepartmentId) : null,
    });
    await auditService.record({
      userId: auditUserId,
      resource: 'department',
      action: 'update',
      resourceId: id,
      changes: {
        moved: true,
        from: dept.parentDepartmentId ? dept.parentDepartmentId.toString() : null,
        to: parentDepartmentId,
      },
    });
    log.info({ departmentId: id, parentDepartmentId }, 'department moved');
    return updated!.toJSON();
  },

  /** UC-09 — bulk-transfer employees from this department to another. */
  async transferEmployees(fromId: string, input: TransferEmployeesDto, auditUserId: string) {
    const { targetDepartmentId, employeeIds } = input;
    if (targetDepartmentId === fromId) {
      throw new HttpError(400, 'Source and target department must differ', 'ORG_010');
    }
    const [from, target] = await Promise.all([
      departmentRepository.findById(fromId),
      departmentRepository.findById(targetDepartmentId),
    ]);
    if (!from) throw new HttpError(404, 'Department not found', 'ORG_001');
    if (!target) throw new HttpError(404, 'Target department not found', 'ORG_001');

    const filter: Record<string, unknown> = {
      departmentId: new Types.ObjectId(fromId),
      status: { $ne: 'terminated' },
    };
    if (employeeIds?.length) {
      filter._id = { $in: employeeIds.map((e) => new Types.ObjectId(e)) };
    }
    const employees = await Employee.find(filter).select('_id').lean();
    if (employees.length === 0) return { transferred: 0 };

    const targetObjId = new Types.ObjectId(targetDepartmentId);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Employee.updateMany(
          { _id: { $in: employees.map((e) => e._id) } },
          { departmentId: targetObjId },
          { session },
        );
        await EmployeeHistory.create(
          employees.map((e) => ({
            employeeId: e._id,
            eventType: 'transfer' as const,
            fromValue: { departmentId: fromId },
            toValue: { departmentId: targetDepartmentId },
            effectiveDate: new Date(),
            note: `Điều chuyển ${from.code} → ${target.code}`,
            createdBy: new Types.ObjectId(auditUserId),
          })),
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    await auditService.record({
      userId: auditUserId,
      resource: 'department',
      action: 'update',
      resourceId: fromId,
      changes: { transferredTo: targetDepartmentId, count: employees.length },
    });
    log.info({ fromId, targetDepartmentId, count: employees.length }, 'employees transferred');
    return { transferred: employees.length };
  },

  /** UC-10 — merge this department into a target: move employees + positions, then archive. */
  async merge(sourceId: string, input: MergeDepartmentDto, auditUserId: string) {
    const { targetDepartmentId } = input;
    if (targetDepartmentId === sourceId) {
      throw new HttpError(400, 'Source and target department must differ', 'ORG_010');
    }
    const [source, target] = await Promise.all([
      departmentRepository.findById(sourceId),
      departmentRepository.findById(targetDepartmentId),
    ]);
    if (!source) throw new HttpError(404, 'Department not found', 'ORG_001');
    if (!target) throw new HttpError(404, 'Target department not found', 'ORG_001');

    const sourceObjId = new Types.ObjectId(sourceId);
    const targetObjId = new Types.ObjectId(targetDepartmentId);

    const employees = await Employee.find({
      departmentId: sourceObjId,
      status: { $ne: 'terminated' },
    })
      .select('_id')
      .lean();

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (employees.length) {
          await Employee.updateMany(
            { _id: { $in: employees.map((e) => e._id) } },
            { departmentId: targetObjId },
            { session },
          );
          await EmployeeHistory.create(
            employees.map((e) => ({
              employeeId: e._id,
              eventType: 'transfer' as const,
              fromValue: { departmentId: sourceId },
              toValue: { departmentId: targetDepartmentId },
              effectiveDate: new Date(),
              note: `Gộp phòng ${source.code} → ${target.code}`,
              createdBy: new Types.ObjectId(auditUserId),
            })),
            { session },
          );
        }
        await Position.updateMany(
          { departmentId: sourceObjId },
          { departmentId: targetObjId },
          { session },
        );
        await departmentRepository.updateById(sourceId, { status: 'archived' }, session);
      });
    } finally {
      await session.endSession();
    }

    await auditService.record({
      userId: auditUserId,
      resource: 'department',
      action: 'delete',
      resourceId: sourceId,
      changes: { mergedInto: targetDepartmentId, movedEmployees: employees.length },
    });
    log.info({ sourceId, targetDepartmentId }, 'department merged');
    const refreshed = await departmentRepository.findById(sourceId);
    return refreshed!.toJSON();
  },

  /** UC-11 — organization-change timeline for a department (from audit log). */
  history(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(400, 'Invalid department id', 'ORG_001');
    }
    return auditService.list({ resource: 'department', resourceId: id });
  },

  /**
   * Hard-delete a department — ONLY when nothing still references it. If any
   * employee, position or sub-department still points here, refuse with a
   * warning listing what remains so the caller clears those first.
   */
  async remove(id: string, auditUserId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(400, 'Invalid department id', 'ORG_001');
    }
    const deptId = new Types.ObjectId(id);
    const [employees, positions, children] = await Promise.all([
      Employee.countDocuments({ departmentId: deptId }),
      Position.countDocuments({ departmentId: deptId }),
      Department.countDocuments({ parentDepartmentId: deptId }),
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

    const deleted = await departmentRepository.deleteById(id);
    if (!deleted) throw new HttpError(404, 'Department not found', 'ORG_001');

    await auditService.record({
      userId: auditUserId,
      resource: 'department',
      action: 'delete',
      resourceId: id,
      changes: { hardDeleted: true, name: deleted.name, code: deleted.code },
    });
    log.info({ departmentId: id }, 'department hard-deleted');
    return { id, deleted: true };
  },

  async archive(id: string, auditUserId: string) {
    const active = await Employee.countDocuments({
      departmentId: new Types.ObjectId(id),
      status: { $in: BLOCKING_STATUSES },
    });
    if (active > 0) {
      throw new HttpError(409, 'Cannot archive department with active employees', 'ORG_004');
    }
    const activeChildren = await departmentRepository.findChildren(id);
    if (activeChildren.some((c) => c.status === 'active')) {
      throw new HttpError(409, 'Cannot archive department with active sub-departments', 'ORG_011');
    }
    const updated = await departmentRepository.updateById(id, { status: 'archived' });
    if (!updated) throw new HttpError(404, 'Department not found', 'ORG_001');

    await auditService.record({
      userId: auditUserId,
      resource: 'department',
      action: 'delete',
      resourceId: id,
      changes: { status: 'archived' },
    });
    return updated.toJSON();
  },
};
