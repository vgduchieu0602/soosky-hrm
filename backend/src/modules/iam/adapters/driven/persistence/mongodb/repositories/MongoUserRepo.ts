import { IAM_COLLECTIONS } from "@modules/iam/adapters/driven/persistence/mongodb/collections";
import UserDocument from "@modules/iam/adapters/driven/persistence/mongodb/documents/UserDocument";
import UserMapper from "@modules/iam/adapters/driven/persistence/mongodb/mappers/UserMapper";
import MongoRepository from "@modules/iam/adapters/driven/persistence/mongodb/MongoRepository";
import UserRepo from "@modules/iam/core/app/ports/UserRepo";
import User from "@modules/iam/core/domain/entities/User";
import { ClientSession, Db } from "mongodb";

export default class MongoUserRepo extends MongoRepository<UserDocument> implements UserRepo {

    public constructor(db: Db, session?: ClientSession) {
        super(db, IAM_COLLECTIONS.users, session);
    }

    public static async ensureIndexes(db: Db): Promise<void> {
        await db.collection<UserDocument>(IAM_COLLECTIONS.users)
            .createIndex({ email: 1 });
    }

    public async getById(userId: string): Promise<User | null> {
        const document = await this._collection.findOne({ _id: userId }, this._sessionOptions);
        return document ? UserMapper.toDomain(document) : null;
    }

    public async existsById(userId: string): Promise<boolean> {
        const count = await this._collection.countDocuments({ _id: userId }, { limit: 1, ...this._sessionOptions });
        return count > 0;
    }

    public async list(): Promise<User[]> {
        const documents = await this._collection
            .find({}, this._sessionOptions)
            .sort({ createdAt: 1 })
            .toArray();
        return documents.map(document => UserMapper.toDomain(document));
    }

    public async save(user: User): Promise<void> {
        const { _id, ...body } = UserMapper.toDocument(user);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }
}
