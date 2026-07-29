import { SETTING_COLLECTIONS } from "@modules/setting/adapters/driven/persistence/mongodb/collections";
import CompanyProfileDocument from "@modules/setting/adapters/driven/persistence/mongodb/documents/CompanyProfileDocument";
import CompanyProfileMapper from "@modules/setting/adapters/driven/persistence/mongodb/mappers/CompanyProfileMapper";
import MongoRepository from "@modules/setting/adapters/driven/persistence/mongodb/MongoRepository";
import CompanyProfileRepo from "@modules/setting/core/app/ports/CompanyProfileRepo";
import CompanyProfile, { COMPANY_PROFILE_ID } from "@modules/setting/core/domain/entities/CompanyProfile";
import { ClientSession, Db } from "mongodb";

export default class MongoCompanyProfileRepo extends MongoRepository<CompanyProfileDocument> implements CompanyProfileRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, SETTING_COLLECTIONS.company, session);
    }

    /** Singleton — `_id` cố định là khoá chính duy nhất, không cần index bổ sung. */
    public static async ensureIndexes(_db: Db): Promise<void> {
        // no-op: chỉ có đúng một document, truy vấn luôn theo `_id`.
    }

    public async get(): Promise<CompanyProfile | undefined> {
        const document = await this._collection.findOne({ _id: COMPANY_PROFILE_ID }, this._sessionOptions);
        return document ? CompanyProfileMapper.toDomain(document) : undefined;
    }

    public async save(companyProfile: CompanyProfile): Promise<void> {
        const { _id, ...body } = CompanyProfileMapper.toDocument(companyProfile);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }
}
