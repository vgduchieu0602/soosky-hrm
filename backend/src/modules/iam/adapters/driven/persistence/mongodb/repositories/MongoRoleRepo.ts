import { IAM_COLLECTIONS } from "@modules/iam/adapters/driven/persistence/mongodb/collections";
import RoleDocument from "@modules/iam/adapters/driven/persistence/mongodb/documents/RoleDocument";
import RoleMapper from "@modules/iam/adapters/driven/persistence/mongodb/mappers/RoleMapper";
import MongoRepository from "@modules/iam/adapters/driven/persistence/mongodb/MongoRepository";
import RoleRepo from "@modules/iam/core/app/ports/RoleRepo";
import Role from "@modules/iam/core/domain/entities/Role";
import RoleKey from "@modules/iam/core/domain/value-objects/RoleKey";
import { ClientSession, Db } from "mongodb";

export default class MongoRoleRepo extends MongoRepository<RoleDocument> implements RoleRepo {

    public constructor(db: Db, session?: ClientSession) {
        super(db, IAM_COLLECTIONS.roles, session);
    }

    public static async ensureIndexes(db: Db): Promise<void> {
        await db.collection<RoleDocument>(IAM_COLLECTIONS.roles)
            .createIndex({ key: 1 }, { unique: true });
    }

    public async getById(roleId: string): Promise<Role | null> {
        const document = await this._collection.findOne({ _id: roleId }, this._sessionOptions);
        return document ? RoleMapper.toDomain(document) : null;
    }

    public async getByKey(key: RoleKey): Promise<Role | null> {
        const document = await this._collection.findOne({ key: key.value }, this._sessionOptions);
        return document ? RoleMapper.toDomain(document) : null;
    }

    public async existsByKey(key: RoleKey): Promise<boolean> {
        const count = await this._collection.countDocuments({ key: key.value }, { limit: 1, ...this._sessionOptions });
        return count > 0;
    }

    public async list(): Promise<Role[]> {
        const documents = await this._collection
            .find({}, this._sessionOptions)
            .sort({ createdAt: 1 })
            .toArray();
        return documents.map(document => RoleMapper.toDomain(document));
    }

    public async save(role: Role): Promise<void> {
        const { _id, ...body } = RoleMapper.toDocument(role);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(roleId: string): Promise<void> {
        await this._collection.deleteOne({ _id: roleId }, this._sessionOptions);
    }
}
