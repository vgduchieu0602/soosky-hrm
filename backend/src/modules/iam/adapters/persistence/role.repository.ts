import { Types } from 'mongoose';
import { Role } from '@modules/iam/adapters/persistence/models/role.model';
import { RolePermission } from '@modules/iam/adapters/persistence/models/role-permission.model';
import { UserRole } from '@modules/iam/adapters/persistence/models/user-role.model';
import type { RoleRepository, ResolvedRoles, Id } from '@modules/iam/core/app/ports';

export class MongooseRoleRepository implements RoleRepository {
  async findActiveByUserId(userId: Id): Promise<ResolvedRoles> {
    const rows = await UserRole.aggregate<{ _id: Types.ObjectId; name: string }>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
        },
      },
      { $lookup: { from: 'roles', localField: 'roleId', foreignField: '_id', as: 'role' } },
      { $unwind: '$role' },
      { $project: { _id: '$role._id', name: '$role.name' } },
    ]);

    return {
      ids: rows.map((r) => String(r._id)),
      names: rows.map((r) => r.name),
    };
  }

  async findByName(name: string): Promise<{ id: string } | null> {
    const role = await Role.findOne({ name });
    return role ? { id: role._id.toString() } : null;
  }

  async create(input: { name: string; description: string }): Promise<{ id: Id; doc: Record<string, unknown> }> {
    const role = await Role.create({ name: input.name, description: input.description, isSystem: false });
    return { id: role._id.toString(), doc: role.toJSON() as unknown as Record<string, unknown> };
  }

  async findById(id: Id): Promise<Record<string, unknown> | null> {
    return Role.findById(id).lean() as unknown as Promise<Record<string, unknown> | null>;
  }

  list(): Promise<Record<string, unknown>[]> {
    return Role.find({}).lean() as unknown as Promise<Record<string, unknown>[]>;
  }

  async updateDescription(id: Id, description: string): Promise<Record<string, unknown> | null> {
    const role = await Role.findByIdAndUpdate(id, { description }, { new: true });
    return role ? (role.toJSON() as unknown as Record<string, unknown>) : null;
  }

  async deleteById(id: Id): Promise<Record<string, unknown> | null> {
    // Query-form deleteOne (does not fire the document `deleteOne` guard hook —
    // preserves the legacy service behavior). System-role protection is enforced
    // in the use-case before this is called.
    await Role.deleteOne({ _id: id });
    return null;
  }

  async permissionIdsOf(roleId: Id): Promise<string[]> {
    const rps = await RolePermission.find({ roleId }).select('permissionId').lean();
    return rps.map((rp) => rp.permissionId.toString());
  }

  async setPermissions(roleId: Id, permissionIds: Id[]): Promise<void> {
    const docs = permissionIds.map((permId) => ({
      roleId: new Types.ObjectId(roleId),
      permissionId: new Types.ObjectId(permId),
    }));
    if (docs.length) await RolePermission.insertMany(docs);
  }

  async replacePermissions(roleId: Id, permissionIds: Id[]): Promise<void> {
    await RolePermission.deleteMany({ roleId });
    const docs = permissionIds.map((permId) => ({
      roleId: new Types.ObjectId(roleId),
      permissionId: new Types.ObjectId(permId),
    }));
    if (docs.length > 0) await RolePermission.insertMany(docs);
  }

  async clearPermissions(roleId: Id): Promise<void> {
    await RolePermission.deleteMany({ roleId });
  }
}
