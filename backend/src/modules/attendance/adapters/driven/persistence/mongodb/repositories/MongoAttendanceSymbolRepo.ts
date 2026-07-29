import { ATTENDANCE_COLLECTIONS } from "@modules/attendance/adapters/driven/persistence/mongodb/collections";
import AttendanceSymbolDocument from "@modules/attendance/adapters/driven/persistence/mongodb/documents/AttendanceSymbolDocument";
import AttendanceSymbolMapper from "@modules/attendance/adapters/driven/persistence/mongodb/mappers/AttendanceSymbolMapper";
import MongoRepository from "@modules/attendance/adapters/driven/persistence/mongodb/MongoRepository";
import AttendanceSymbolRepo from "@modules/attendance/core/app/ports/AttendanceSymbolRepo";
import AttendanceSymbol from "@modules/attendance/core/domain/entities/AttendanceSymbol";
import { ClientSession, Db } from "mongodb";

export default class MongoAttendanceSymbolRepo extends MongoRepository<AttendanceSymbolDocument> implements AttendanceSymbolRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, ATTENDANCE_COLLECTIONS.symbols, session);
    }

    /** Index: mã ký hiệu là duy nhất. */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<AttendanceSymbolDocument>(ATTENDANCE_COLLECTIONS.symbols);
        await collection.createIndex({ code: 1 }, { unique: true });
    }

    public async getById(id: string): Promise<AttendanceSymbol | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? AttendanceSymbolMapper.toDomain(document) : undefined;
    }

    public async getByCode(code: string): Promise<AttendanceSymbol | undefined> {
        const document = await this._collection.findOne({ code }, this._sessionOptions);
        return document ? AttendanceSymbolMapper.toDomain(document) : undefined;
    }

    public async listAll(): Promise<AttendanceSymbol[]> {
        const documents = await this._collection
            .find({}, { sort: { code: 1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(AttendanceSymbolMapper.toDomain);
    }

    public async save(symbol: AttendanceSymbol): Promise<void> {
        const { _id, ...body } = AttendanceSymbolMapper.toDocument(symbol);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
