import { IAM_COLLECTIONS } from "@modules/iam/adapters/driven/persistence/mongodb/collections";
import PermissionDocument from "@modules/iam/adapters/driven/persistence/mongodb/documents/PermissionDocument";
import PermissionMapper from "@modules/iam/adapters/driven/persistence/mongodb/mappers/PermissionMapper";
import MongoRepository from "@modules/iam/adapters/driven/persistence/mongodb/MongoRepository";
import PermissionRepo from "@modules/iam/core/app/ports/PermissionRepo";
import Permission from "@modules/iam/core/domain/entities/Permission";
import PermissionKey from "@modules/iam/core/domain/value-objects/PermissionKey";
import { ClientSession, Db } from "mongodb";

export default class MongoPermissionRepo extends MongoRepository<PermissionDocument> implements PermissionRepo {

    public constructor(db: Db, session?: ClientSession) {
        super(db, IAM_COLLECTIONS.permissions, session);
    }

    public static async ensureIndexes(db: Db): Promise<void> {
        await db.collection<PermissionDocument>(IAM_COLLECTIONS.permissions)
            .createIndex({ key: 1 }, { unique: true });
    }

    public async getById(permissionId: string): Promise<Permission | null> {
        const document = await this._collection.findOne({ _id: permissionId }, this._sessionOptions);
        return document ? PermissionMapper.toDomain(document) : null;
    }

    public async getByKey(key: PermissionKey): Promise<Permission | null> {
        const document = await this._collection.findOne({ key: key.value }, this._sessionOptions);
        return document ? PermissionMapper.toDomain(document) : null;
    }

    public async existsByKey(key: PermissionKey): Promise<boolean> {
        const count = await this._collection.countDocuments({ key: key.value }, { limit: 1, ...this._sessionOptions });
        return count > 0;
    }

    public async listByIds(permissionIds: string[]): Promise<Permission[]> {
        if (permissionIds.length === 0) return [];
        const documents = await this._collection
            .find({ _id: { $in: permissionIds } }, this._sessionOptions)
            .toArray();
        return documents.map(document => PermissionMapper.toDomain(document));
    }

    public async list(): Promise<Permission[]> {
        const documents = await this._collection
            .find({}, this._sessionOptions)
            .sort({ createdAt: 1 })
            .toArray();
        return documents.map(document => PermissionMapper.toDomain(document));
    }

    public async save(permission: Permission): Promise<void> {
        const { _id, ...body } = PermissionMapper.toDocument(permission);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }
}
