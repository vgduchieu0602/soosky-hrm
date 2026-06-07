import { Types } from 'mongoose';
import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { Department } from '@shared/models/department.model';
import { Employee } from '@shared/models/employee.model';
import type { IPosition } from '@shared/models/position.model';
import { positionRepository } from '@features/organization/repositories/position.repository';
import { auditService } from '@features/iam/services/audit.service';
import type {
  CreatePositionDto,
  UpdatePositionDto,
} from '@features/organization/dto/position.dto';

const log = logger.child({ feature: 'organization', module: 'position' });

export const positionService = {
  list(filter: { departmentId?: string }) {
    return positionRepository.list(filter);
  },

  async findById(id: string) {
    const position = await positionRepository.findById(id);
    if (!position) throw new HttpError(404, 'Position not found', 'ORG_005');
    return position.toJSON();
  },

  async create(input: CreatePositionDto, auditUserId: string) {
    const dept = await Department.findById(input.departmentId).lean();
    if (!dept) throw new HttpError(404, 'Department not found', 'ORG_001');

    const dup = await positionRepository.findByCode(input.code);
    if (dup) throw new HttpError(409, 'Position code already exists', 'ORG_006');

    const position = await positionRepository.create({
      ...input,
      code: input.code.trim().toUpperCase(),
      departmentId: new Types.ObjectId(input.departmentId),
    });
    await auditService.record({
      userId: auditUserId,
      resource: 'position',
      action: 'create',
      resourceId: position._id.toString(),
    });
    log.info({ positionId: position._id }, 'position created');
    return position.toJSON();
  },

  async update(id: string, input: UpdatePositionDto, auditUserId: string) {
    if (input.departmentId) {
      const dept = await Department.findById(input.departmentId).lean();
      if (!dept) throw new HttpError(404, 'Department not found', 'ORG_001');
    }
    const { departmentId, ...rest } = input;
    const patch: Partial<IPosition> = { ...rest };
    if (departmentId) patch.departmentId = new Types.ObjectId(departmentId);
    const updated = await positionRepository.updateById(id, patch);
    if (!updated) throw new HttpError(404, 'Position not found', 'ORG_005');

    await auditService.record({
      userId: auditUserId,
      resource: 'position',
      action: 'update',
      resourceId: id,
      changes: input as Record<string, unknown>,
    });
    return updated.toJSON();
  },

  async remove(id: string, auditUserId: string) {
    const inUse = await Employee.countDocuments({ positionId: new Types.ObjectId(id) });
    if (inUse > 0) {
      throw new HttpError(409, 'Cannot delete position assigned to employees', 'ORG_007');
    }
    const deleted = await positionRepository.deleteById(id);
    if (!deleted) throw new HttpError(404, 'Position not found', 'ORG_005');
    await auditService.record({
      userId: auditUserId,
      resource: 'position',
      action: 'delete',
      resourceId: id,
    });
    return { id };
  },
};
