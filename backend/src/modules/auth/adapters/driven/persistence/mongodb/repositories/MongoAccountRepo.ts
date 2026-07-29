import { AUTH_COLLECTIONS } from "@modules/auth/adapters/driven/persistence/mongodb/collections";
import AccountDocument from "@modules/auth/adapters/driven/persistence/mongodb/documents/AccountDocument";
import AccountMapper from "@modules/auth/adapters/driven/persistence/mongodb/mappers/AccountMapper";
import MongoRepository from "@modules/auth/adapters/driven/persistence/mongodb/MongoRepository";
import AccountRepo, { AccountListFilter } from "@modules/auth/core/app/ports/AccountRepo";
import Account from "@modules/auth/core/domain/entities/Account";
import AccountRole from "@modules/auth/core/domain/value-objects/AccountRole";
import Email from "@shared/core/domain/value-objects/email/Email";
import { ClientSession, Db } from "mongodb";

export default class MongoAccountRepo extends MongoRepository<AccountDocument> implements AccountRepo {

    public constructor(db: Db, session?: ClientSession) {
        super(db, AUTH_COLLECTIONS.accounts, session);
    }

    /**
     * Tạo các index mà collection này cần, gọi một lần lúc khởi động ứng dụng.
     *
     * Unique index trên email là chốt chặn cuối cho các use-case kiểm tra email
     * trùng (Register, UpdateProfile) — bước kiểm tra ở tầng app không atomic
     * với bước lưu.
     */
    public static async ensureIndexes(db: Db): Promise<void> {
        await db.collection<AccountDocument>(AUTH_COLLECTIONS.accounts)
            .createIndex({ email: 1 }, { unique: true });
    }

    public async getById(accountId: string): Promise<Account | null> {
        const document = await this._collection.findOne({ _id: accountId }, this._sessionOptions);
        return document ? AccountMapper.toDomain(document) : null;
    }

    public async getByEmail(email: Email): Promise<Account | null> {
        const document = await this._collection.findOne({ email: email.value }, this._sessionOptions);
        return document ? AccountMapper.toDomain(document) : null;
    }

    public async existsByEmail(email: Email): Promise<boolean> {
        const count = await this._collection.countDocuments({ email: email.value }, { limit: 1, ...this._sessionOptions });
        return count > 0;
    }

    public async existsByRole(role: AccountRole): Promise<boolean> {
        const count = await this._collection.countDocuments({ role: role.value }, { limit: 1, ...this._sessionOptions });
        return count > 0;
    }

    public async list(filter: AccountListFilter): Promise<Account[]> {
        const query = filter.status ? { status: filter.status } : {};
        const documents = await this._collection
            .find(query, this._sessionOptions)
            .sort({ createdAt: 1 })
            .toArray();
        return documents.map(document => AccountMapper.toDomain(document));
    }

    public async save(account: Account): Promise<void> {
        const { _id, ...body } = AccountMapper.toDocument(account);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(accountId: string): Promise<void> {
        await this._collection.deleteOne({ _id: accountId }, this._sessionOptions);
    }
}
