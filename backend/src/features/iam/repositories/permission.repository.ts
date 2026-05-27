import { Types } from 'mongoose';
import { RolePermission } from '@shared/models/role-permission.model';

export const permissionRepository = {
  async findKeysByRoleIds(roleIds: Types.ObjectId[]): Promise<string[]> {
    if (roleIds.length === 0) return [];
    const rows = await RolePermission.aggregate<{ key: string }>([
      { $match: { roleId: { $in: roleIds } } },
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
  },
};
