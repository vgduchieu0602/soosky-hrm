import { HttpError } from '@shared/errors/http-error';
import { logger } from '@core/logger/logger';

import { Permission, type PermissionAction, type PermissionDoc } from '@shared/models/permission.model';
import { auditService } from '@features/iam/services/audit.service';

const log = logger.child({ feature: 'iam', module: 'permission' });

export interface CreatePermissionInput {
  key: string;
  resource: string;
  action: PermissionAction;
  description?: string;
}

export interface UpdatePermissionInput {
  description?: string;
}

export const permissionService = {
  async create(input: CreatePermissionInput, auditUserId: string): Promise<PermissionDoc> {
    const existing = await Permission.findOne({ key: input.key });
    if (existing) throw new HttpError(409, 'Permission key already exists', 'IAM_009');

    const permission = await Permission.create({
      key: input.key,
      resource: input.resource,
      action: input.action,
      description: input.description || '',
    });

    await auditService.record({
      userId: auditUserId,
      resource: 'permission',
      action: 'create',
      resourceId: permission._id.toString(),
      changes: { key: permission.key },
    });

    log.info({ permissionId: permission._id }, 'permission created');
    return permission;
  },

  async findById(permissionId: string) {
    const permission = await Permission.findById(permissionId);
    if (!permission) throw new HttpError(404, 'Permission not found', 'IAM_010');
    return permission;
  },

  async list() {
    return Permission.find({}).lean();
  },

  async update(permissionId: string, input: UpdatePermissionInput, auditUserId: string) {
    const permission = await Permission.findByIdAndUpdate(permissionId, input as Record<string, unknown>, { new: true });
    if (!permission) throw new HttpError(404, 'Permission not found', 'IAM_010');

    await auditService.record({
      userId: auditUserId,
      resource: 'permission',
      action: 'update',
      resourceId: permissionId,
      changes: input as Record<string, unknown>,
    });

    log.info({ permissionId }, 'permission updated');
    return permission;
  },

  async delete(permissionId: string, auditUserId: string) {
    const permission = await Permission.findByIdAndDelete(permissionId);
    if (!permission) throw new HttpError(404, 'Permission not found', 'IAM_010');

    await auditService.record({
      userId: auditUserId,
      resource: 'permission',
      action: 'delete',
      resourceId: permissionId,
      changes: { key: permission.key },
    });

    log.info({ permissionId }, 'permission deleted');
    return permission;
  },
};
