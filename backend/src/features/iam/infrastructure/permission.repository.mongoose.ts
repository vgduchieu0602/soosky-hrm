import { Types } from 'mongoose';
import { Permission, type PermissionAction } from '@shared/models/permission.model';
import { RolePermission } from '@shared/models/role-permission.model';
import type { PermissionRepository, Id } from '@features/iam/domain/ports';

export class MongoosePermissionRepository implements PermissionRepository {
  async findKeysByRoleIds(roleIds: Id[]): Promise<string[]> {
    if (roleIds.length === 0) return [];
    const objIds = roleIds.map((id) => new Types.ObjectId(id));
    const rows = await RolePermission.aggregate<{ key: string }>([
      { $match: { roleId: { $in: objIds } } },
      {
        $lookup: {
          from: 'permissions',
          localField: 'permissionId',
          foreignField: '_id',
          as: 'permission',
        },
      },
      { $unwind: '$permission' },
      { $group: { _id: '$permission.key' } },
      { $project: { _id: 0, key: '$_id' } },
    ]);
    return rows.map((r) => r.key);
  }

  async findByKey(key: string): Promise<{ id: string } | null> {
    const permission = await Permission.findOne({ key });
    return permission ? { id: permission._id.toString() } : null;
  }

  async create(input: {
    key: string; resource: string; action: string; description: string;
  }): Promise<{ id: Id; doc: Record<string, unknown> }> {
    const permission = await Permission.create({
      key: input.key,
      resource: input.resource,
      action: input.action as PermissionAction,
      description: input.description,
    });
    return { id: permission._id.toString(), doc: permission.toJSON() as unknown as Record<string, unknown> };
  }

  async findById(id: Id): Promise<Record<string, unknown> | null> {
    const permission = await Permission.findById(id);
    return permission ? (permission.toJSON() as unknown as Record<string, unknown>) : null;
  }

  list(): Promise<Record<string, unknown>[]> {
    return Permission.find({}).lean() as unknown as Promise<Record<string, unknown>[]>;
  }

  async updateById(id: Id, patch: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const permission = await Permission.findByIdAndUpdate(id, patch, { new: true });
    return permission ? (permission.toJSON() as unknown as Record<string, unknown>) : null;
  }

  async deleteById(id: Id): Promise<Record<string, unknown> | null> {
    const permission = await Permission.findByIdAndDelete(id);
    return permission ? (permission.toJSON() as unknown as Record<string, unknown>) : null;
  }
}
