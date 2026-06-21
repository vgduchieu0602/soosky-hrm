import { Types } from 'mongoose';
import { HttpError } from '@shared/errors/http-error';
import { logger } from '@core/logger/logger';

import { Role, type RoleDoc } from '@shared/models/role.model';
import { RolePermission } from '@shared/models/role-permission.model';
import { auditService } from '@features/iam/services/audit.service';

const log = logger.child({ feature: 'iam', module: 'role' });

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissionIds?: string[];
}

export interface UpdateRoleInput {
  description?: string;
  permissionIds?: string[];
}

export const roleService = {
  async create(input: CreateRoleInput, auditUserId: string): Promise<RoleDoc> {
    const existing = await Role.findOne({ name: input.name });
    if (existing) throw new HttpError(409, 'Role name already exists', 'IAM_006');

    const role = await Role.create({
      name: input.name,
      description: input.description || '',
      isSystem: false,
    });

    if (input.permissionIds?.length) {
      const permissionDocs = input.permissionIds.map((permId) => ({
        roleId: role._id,
        permissionId: new Types.ObjectId(permId),
      }));
      await RolePermission.insertMany(permissionDocs);
    }

    await auditService.record({
      userId: auditUserId,
      resource: 'role',
      action: 'create',
      resourceId: role._id.toString(),
      changes: { name: role.name },
    });

    log.info({ roleId: role._id }, 'role created');
    return role;
  },

  async findById(roleId: string) {
    const role = await Role.findById(roleId).lean();
    if (!role) throw new HttpError(404, 'Role not found', 'IAM_007');
    const rps = await RolePermission.find({ roleId }).select('permissionId').lean();
    return { ...role, permissionIds: rps.map((rp) => rp.permissionId.toString()) };
  },

  async list() {
    return Role.find({}).lean();
  },

  async update(roleId: string, input: UpdateRoleInput, auditUserId: string) {
    const role = await Role.findById(roleId);
    if (!role) throw new HttpError(404, 'Role not found', 'IAM_007');

    // System roles (admin/hr_manager/employee) may have their description and
    // permissions edited, but their NAME is protected — grant-login and the
    // requireRoles guards reference those names by string. Deletion stays blocked
    // (handled in `remove`).
    if (input.description !== undefined) {
      role.description = input.description;
    }

    await role.save();

    if (input.permissionIds) {
      await RolePermission.deleteMany({ roleId });
      const permissionDocs = input.permissionIds.map((permId) => ({
        roleId: role._id,
        permissionId: new Types.ObjectId(permId),
      }));
      if (permissionDocs.length > 0) {
        await RolePermission.insertMany(permissionDocs);
      }
    }

    await auditService.record({
      userId: auditUserId,
      resource: 'role',
      action: 'update',
      resourceId: roleId,
      changes: input as Record<string, unknown>,
    });

    log.info({ roleId }, 'role updated');
    return role;
  },

  async delete(roleId: string, auditUserId: string) {
    const role = await Role.findById(roleId);
    if (!role) throw new HttpError(404, 'Role not found', 'IAM_007');

    if (role.isSystem) {
      throw new HttpError(403, 'Cannot delete system roles', 'IAM_008');
    }

    await Role.deleteOne({ _id: roleId });
    await RolePermission.deleteMany({ roleId });

    await auditService.record({
      userId: auditUserId,
      resource: 'role',
      action: 'delete',
      resourceId: roleId,
      changes: { name: role.name },
    });

    log.info({ roleId }, 'role deleted');
    return role;
  },
};
