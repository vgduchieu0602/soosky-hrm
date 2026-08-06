import { SETTING_COLLECTIONS } from "@modules/setting/adapters/driven/persistence/mongodb/collections";
import BankTransferProfileDocument from "@modules/setting/adapters/driven/persistence/mongodb/documents/BankTransferProfileDocument";
import BankTransferProfileMapper from "@modules/setting/adapters/driven/persistence/mongodb/mappers/BankTransferProfileMapper";
import MongoRepository from "@modules/setting/adapters/driven/persistence/mongodb/MongoRepository";
import BankTransferProfileRepo from "@modules/setting/core/app/ports/BankTransferProfileRepo";
import BankTransferProfile from "@modules/setting/core/domain/entities/BankTransferProfile";
import { ClientSession, Db } from "mongodb";

export default class MongoBankTransferProfileRepo extends MongoRepository<BankTransferProfileDocument> implements BankTransferProfileRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, SETTING_COLLECTIONS.bankProfiles, session);
    }

    /** Index: mã hồ sơ duy nhất; tra hồ sơ đang bật là đường nóng lúc xuất file. */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<BankTransferProfileDocument>(SETTING_COLLECTIONS.bankProfiles);
        await collection.createIndex({ code: 1 }, { unique: true });
        await collection.createIndex({ isActive: 1 });
    }

    public async getById(id: string): Promise<BankTransferProfile | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? BankTransferProfileMapper.toDomain(document) : undefined;
    }

    public async findByCode(code: string): Promise<BankTransferProfile | undefined> {
        const document = await this._collection.findOne({ code }, this._sessionOptions);
        return document ? BankTransferProfileMapper.toDomain(document) : undefined;
    }

    public async list(): Promise<BankTransferProfile[]> {
        const documents = await this._collection
            .find({}, { sort: { code: 1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(BankTransferProfileMapper.toDomain);
    }

    public async findActive(): Promise<BankTransferProfile | undefined> {
        const document = await this._collection.findOne({ isActive: true }, this._sessionOptions);
        return document ? BankTransferProfileMapper.toDomain(document) : undefined;
    }

    public async save(profile: BankTransferProfile): Promise<void> {
        const { _id, ...body } = BankTransferProfileMapper.toDocument(profile);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
