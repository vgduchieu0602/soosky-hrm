import { Types } from 'mongoose';
import { HttpError } from '@shared/errors/http-error';
import { employeeAssetRepository } from '@features/employee/repositories/employee-asset.repository';
import { employeeRepository } from '@features/employee/repositories/employee.repository';
import { auditService } from '@features/iam/services/audit.service';
import type {
  CreateAssetDto,
  ReturnAssetDto,
} from '@features/employee/dto/sub-resource.dto';

export const employeeAssetService = {
  async list(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) {
      throw new HttpError(400, 'Invalid employee id', 'EMP_001');
    }
    return employeeAssetRepository.listByEmployee(employeeId);
  },

  async create(employeeId: string, input: CreateAssetDto, auditUserId: string) {
    const emp = await employeeRepository.findById(employeeId);
    if (!emp) throw new HttpError(404, 'Employee not found', 'EMP_001');

    const asset = await employeeAssetRepository.create({
      ...input,
      employeeId: new Types.ObjectId(employeeId),
    });
    await auditService.record({
      userId: auditUserId,
      resource: 'employeeAsset',
      action: 'create',
      resourceId: asset._id.toString(),
    });
    return asset.toJSON();
  },

  async markReturned(assetId: string, input: ReturnAssetDto, auditUserId: string) {
    const updated = await employeeAssetRepository.markReturned(assetId, input);
    if (!updated) throw new HttpError(404, 'Asset not found', 'EMP_007');
    await auditService.record({
      userId: auditUserId,
      resource: 'employeeAsset',
      action: 'update',
      resourceId: assetId,
      changes: input as Record<string, unknown>,
    });
    return updated.toJSON();
  },
};
