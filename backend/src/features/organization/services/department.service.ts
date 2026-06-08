import { Types } from 'mongoose';
import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { Employee } from '@shared/models/employee.model';
import type { IDepartment } from '@shared/models/department.model';
import { departmentRepository } from '@features/organization/repositories/department.repository';
import { auditService } from '@features/iam/services/audit.service';
import type {
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from '@features/organization/dto/department.dto';

const log = logger.child({ feature: 'organization', module: 'department' });

interface DeptNode {
  id: string;
  name: string;
  code: string;
  parentDepartmentId: string | null;
  description?: string;
  status: string;
  headcount: number;
  children: DeptNode[];
}

export const departmentService = {
  async list(asTree = false) {
    const all = await departmentRepository.findAll();
    const counts = await Employee.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { status: { $ne: 'terminated' } } },
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map<string, number>(counts.map((c) => [c._id.toString(), c.count]));

    const flat: DeptNode[] = all.map((d) => ({
      id: d._id.toString(),
      name: d.name,
      code: d.code,
      parentDepartmentId: d.parentDepartmentId ? d.parentDepartmentId.toString() : null,
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

    const dept = await departmentRepository.create({
      ...input,
      code: input.code.trim().toUpperCase(),
      parentDepartmentId: input.parentDepartmentId
        ? new Types.ObjectId(input.parentDepartmentId)
        : null,
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
    const { parentDepartmentId, code, ...rest } = input;
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

  async archive(id: string, auditUserId: string) {
    const active = await Employee.countDocuments({
      departmentId: new Types.ObjectId(id),
      status: { $in: ['active', 'onboarding', 'on_leave'] },
    });
    if (active > 0) {
      throw new HttpError(
        409,
        'Cannot archive department with active employees',
        'ORG_004',
      );
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
