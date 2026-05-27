import { Types } from 'mongoose';
import { UserRole } from '@shared/models/user-role.model';

export const roleRepository = {
  /**
   * Resolve active role assignments for a user (excluding expired temporary grants).
   * Returns parallel arrays for easy passing to downstream queries.
   */
  async findActiveByUserId(userId: string): Promise<{ ids: Types.ObjectId[]; names: string[] }> {
    const rows = await UserRole.aggregate<{ _id: Types.ObjectId; name: string }>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
        },
      },
      {
        $lookup: {
          from: 'roles',
          localField: 'roleId',
          foreignField: '_id',
          as: 'role',
        },
      },
      { $unwind: '$role' },
      { $project: { _id: '$role._id', name: '$role.name' } },
    ]);

    return {
      ids: rows.map((r) => r._id),
      names: rows.map((r) => r.name),
    };
  },
};
