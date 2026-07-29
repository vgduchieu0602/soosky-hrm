import { IAM_COLLECTIONS } from "@modules/iam/adapters/driven/persistence/mongodb/collections";
import RolePermissionDocument from "@modules/iam/adapters/driven/persistence/mongodb/documents/RolePermissionDocument";
import RolePermissionMapper from "@modules/iam/adapters/driven/persistence/mongodb/mappers/RolePermissionMapper";
import MongoRepository from "@modules/iam/adapters/driven/persistence/mongodb/MongoRepository";
import RolePermissionRepo from "@modules/iam/core/app/ports/RolePermissionRepo";
import RolePermission from "@modules/iam/core/domain/entities/RolePermission";
import { ClientSession, Db } from "mongodb";

export default class MongoRolePermissionRepo extends MongoRepository<RolePermissionDocument> implements RolePermissionRepo {

    public constructor(db: Db, session?: ClientSession) {
        super(db, IAM_COLLECTIONS.rolePermissions, session);
    }

    public static async ensureIndexes(db: Db): Promise<void> {
        await db.collection<RolePermissionDocument>(IAM_COLLECTIONS.rolePermissions)
            .createIndex({ roleId: 1, permissionId: 1 }, { unique: true });
    }

    public async listByRoleId(roleId: string): Promise<RolePermission[]> {
        const documents = await this._collection.find({ roleId }, this._sessionOptions).toArray();
        return documents.map(document => RolePermissionMapper.toDomain(document));
    }

    public async listByRoleIds(roleIds: string[]): Promise<RolePermission[]> {
        if (roleIds.length === 0) return [];
        const documents = await this._collection
            .find({ roleId: { $in: roleIds } }, this._sessionOptions)
            .toArray();
        return documents.map(document => RolePermissionMapper.toDomain(document));
    }

    public async save(rolePermission: RolePermission): Promise<void> {
        const { _id, ...body } = RolePermissionMapper.toDocument(rolePermission);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async replaceForRole(roleId: string, rolePermissions: RolePermission[]): Promise<void> {
        await this._collection.deleteMany({ roleId }, this._sessionOptions);
        if (rolePermissions.length === 0) return;

        const documents = rolePermissions.map(rolePermission => RolePermissionMapper.toDocument(rolePermission));
        await this._collection.insertMany(documents, this._sessionOptions);
    }

    public async deleteByRoleId(roleId: string): Promise<void> {
        await this._collection.deleteMany({ roleId }, this._sessionOptions);
    }
}
