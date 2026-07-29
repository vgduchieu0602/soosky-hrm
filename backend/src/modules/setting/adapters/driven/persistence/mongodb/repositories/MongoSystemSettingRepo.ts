import { SETTING_COLLECTIONS } from "@modules/setting/adapters/driven/persistence/mongodb/collections";
import SystemSettingDocument from "@modules/setting/adapters/driven/persistence/mongodb/documents/SystemSettingDocument";
import SystemSettingMapper from "@modules/setting/adapters/driven/persistence/mongodb/mappers/SystemSettingMapper";
import MongoRepository from "@modules/setting/adapters/driven/persistence/mongodb/MongoRepository";
import SystemSettingRepo from "@modules/setting/core/app/ports/SystemSettingRepo";
import SystemSetting, { SYSTEM_SETTING_ID } from "@modules/setting/core/domain/entities/SystemSetting";
import { ClientSession, Db } from "mongodb";

export default class MongoSystemSettingRepo extends MongoRepository<SystemSettingDocument> implements SystemSettingRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, SETTING_COLLECTIONS.system, session);
    }

    /** Singleton — `_id` cố định là khoá chính duy nhất, không cần index bổ sung. */
    public static async ensureIndexes(_db: Db): Promise<void> {
        // no-op: chỉ có đúng một document, truy vấn luôn theo `_id`.
    }

    public async get(): Promise<SystemSetting | undefined> {
        const document = await this._collection.findOne({ _id: SYSTEM_SETTING_ID }, this._sessionOptions);
        return document ? SystemSettingMapper.toDomain(document) : undefined;
    }

    public async save(systemSetting: SystemSetting): Promise<void> {
        const { _id, ...body } = SystemSettingMapper.toDocument(systemSetting);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }
}
