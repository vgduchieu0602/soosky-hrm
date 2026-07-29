import { ATTENDANCE_COLLECTIONS } from "@modules/attendance/adapters/driven/persistence/mongodb/collections";
import ShiftDocument from "@modules/attendance/adapters/driven/persistence/mongodb/documents/ShiftDocument";
import ShiftMapper from "@modules/attendance/adapters/driven/persistence/mongodb/mappers/ShiftMapper";
import MongoRepository from "@modules/attendance/adapters/driven/persistence/mongodb/MongoRepository";
import ShiftRepo from "@modules/attendance/core/app/ports/ShiftRepo";
import Shift from "@modules/attendance/core/domain/entities/Shift";
import ShiftStatus from "@modules/attendance/core/domain/value-objects/ShiftStatus";
import { ClientSession, Db } from "mongodb";

export default class MongoShiftRepo extends MongoRepository<ShiftDocument> implements ShiftRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, ATTENDANCE_COLLECTIONS.shifts, session);
    }

    /** Index: mã ca là duy nhất; index theo trạng thái để liệt kê ca đang hoạt động. */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<ShiftDocument>(ATTENDANCE_COLLECTIONS.shifts);
        await collection.createIndex({ code: 1 }, { unique: true });
        await collection.createIndex({ status: 1 });
    }

    public async getById(id: string): Promise<Shift | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? ShiftMapper.toDomain(document) : undefined;
    }

    public async getByCode(code: string): Promise<Shift | undefined> {
        const document = await this._collection.findOne({ code }, this._sessionOptions);
        return document ? ShiftMapper.toDomain(document) : undefined;
    }

    public async listAll(): Promise<Shift[]> {
        const documents = await this._collection
            .find({}, { sort: { startTime: 1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(ShiftMapper.toDomain);
    }

    public async listActive(): Promise<Shift[]> {
        const documents = await this._collection
            .find({ status: ShiftStatus.ACTIVE.value }, { sort: { startTime: 1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(ShiftMapper.toDomain);
    }

    public async save(shift: Shift): Promise<void> {
        const { _id, ...body } = ShiftMapper.toDocument(shift);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
