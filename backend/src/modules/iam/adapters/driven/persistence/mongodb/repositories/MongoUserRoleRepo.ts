import { IAM_COLLECTIONS } from "@modules/iam/adapters/driven/persistence/mongodb/collections";
import UserRoleDocument from "@modules/iam/adapters/driven/persistence/mongodb/documents/UserRoleDocument";
import UserRoleMapper from "@modules/iam/adapters/driven/persistence/mongodb/mappers/UserRoleMapper";
import MongoRepository from "@modules/iam/adapters/driven/persistence/mongodb/MongoRepository";
import UserRoleRepo from "@modules/iam/core/app/ports/UserRoleRepo";
import UserRole from "@modules/iam/core/domain/entities/UserRole";
import { ClientSession, Db } from "mongodb";

export default class MongoUserRoleRepo extends MongoRepository<UserRoleDocument> implements UserRoleRepo {

    public constructor(db: Db, session?: ClientSession) {
        super(db, IAM_COLLECTIONS.userRoles, session);
    }

    /**
     * Unique compound index {userId, roleId}: chốt chặn cuối chống gán trùng
     * role cho cùng một user khi hai request chạy đua.
     */
    public static async ensureIndexes(db: Db): Promise<void> {
        await db.collection<UserRoleDocument>(IAM_COLLECTIONS.userRoles)
            .createIndex({ userId: 1, roleId: 1 }, { unique: true });
    }

    public async getByUserAndRole(userId: string, roleId: string): Promise<UserRole | null> {
        const document = await this._collection.findOne({ userId, roleId }, this._sessionOptions);
        return document ? UserRoleMapper.toDomain(document) : null;
    }

    public async listByUserId(userId: string): Promise<UserRole[]> {
        const documents = await this._collection.find({ userId }, this._sessionOptions).toArray();
        return documents.map(document => UserRoleMapper.toDomain(document));
    }

    public async listByRoleId(roleId: string): Promise<UserRole[]> {
        const documents = await this._collection.find({ roleId }, this._sessionOptions).toArray();
        return documents.map(document => UserRoleMapper.toDomain(document));
    }

    public async existsByRoleId(roleId: string): Promise<boolean> {
        const count = await this._collection.countDocuments({ roleId }, { limit: 1, ...this._sessionOptions });
        return count > 0;
    }

    public async save(userRole: UserRole): Promise<void> {
        const { _id, ...body } = UserRoleMapper.toDocument(userRole);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(userRoleId: string): Promise<void> {
        await this._collection.deleteOne({ _id: userRoleId }, this._sessionOptions);
    }
}
