import { ATTENDANCE_COLLECTIONS } from "@modules/attendance/adapters/driven/persistence/mongodb/collections";
import HolidayDocument from "@modules/attendance/adapters/driven/persistence/mongodb/documents/HolidayDocument";
import HolidayMapper from "@modules/attendance/adapters/driven/persistence/mongodb/mappers/HolidayMapper";
import MongoRepository from "@modules/attendance/adapters/driven/persistence/mongodb/MongoRepository";
import HolidayRepo from "@modules/attendance/core/app/ports/HolidayRepo";
import Holiday from "@modules/attendance/core/domain/entities/Holiday";
import { ClientSession, Db } from "mongodb";

export default class MongoHolidayRepo extends MongoRepository<HolidayDocument> implements HolidayRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, ATTENDANCE_COLLECTIONS.holidays, session);
    }

    /** Index: theo ngày để tra cứu khoảng ngày lễ nhanh. */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<HolidayDocument>(ATTENDANCE_COLLECTIONS.holidays);
        await collection.createIndex({ date: 1 });
    }

    public async getById(id: string): Promise<Holiday | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? HolidayMapper.toDomain(document) : undefined;
    }

    public async listAll(): Promise<Holiday[]> {
        const documents = await this._collection
            .find({}, { sort: { date: 1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(HolidayMapper.toDomain);
    }

    public async listOverlapping(start: Date, end: Date): Promise<Holiday[]> {
        // Ngày lễ cố định trong khoảng, cộng toàn bộ ngày lễ lặp lại (khớp theo
        // mm-dd ở tầng ứng dụng thay vì ở đây, vì cần tính lại theo từng năm).
        const documents = await this._collection
            .find({ $or: [{ date: { $gte: start, $lte: end } }, { isRecurring: true }] }, this._sessionOptions)
            .toArray();
        return documents.map(HolidayMapper.toDomain);
    }

    public async save(holiday: Holiday): Promise<void> {
        const { _id, ...body } = HolidayMapper.toDocument(holiday);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
