import { ATTENDANCE_COLLECTIONS } from "@modules/attendance/adapters/driven/persistence/mongodb/collections";
import AttendanceCorrectionRequestDocument from "@modules/attendance/adapters/driven/persistence/mongodb/documents/AttendanceCorrectionRequestDocument";
import AttendanceCorrectionRequestMapper from "@modules/attendance/adapters/driven/persistence/mongodb/mappers/AttendanceCorrectionRequestMapper";
import MongoRepository from "@modules/attendance/adapters/driven/persistence/mongodb/MongoRepository";
import AttendanceCorrectionRequestRepo, { CorrectionListFilter } from "@modules/attendance/core/app/ports/AttendanceCorrectionRequestRepo";
import AttendanceCorrectionRequest from "@modules/attendance/core/domain/entities/AttendanceCorrectionRequest";
import { ClientSession, Db, Filter } from "mongodb";

export default class MongoAttendanceCorrectionRequestRepo
    extends MongoRepository<AttendanceCorrectionRequestDocument>
    implements AttendanceCorrectionRequestRepo {

    public constructor(db: Db, session?: ClientSession) {
        super(db, ATTENDANCE_COLLECTIONS.correctionRequests, session);
    }

    /** Index: hàng chờ duyệt theo trạng thái, và tra yêu cầu của một nhân viên tại một ngày. */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<AttendanceCorrectionRequestDocument>(ATTENDANCE_COLLECTIONS.correctionRequests);
        await collection.createIndex({ status: 1, createdAt: -1 });
        await collection.createIndex({ employeeId: 1, date: 1, status: 1 });
    }

    public async getById(id: string): Promise<AttendanceCorrectionRequest | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? AttendanceCorrectionRequestMapper.toDomain(document) : undefined;
    }

    public async list(filter: CorrectionListFilter): Promise<AttendanceCorrectionRequest[]> {
        const query: Filter<AttendanceCorrectionRequestDocument> = {};
        if (filter.employeeIds != undefined) query.employeeId = { $in: [...filter.employeeIds] };
        if (filter.status != undefined)      query.status = filter.status;

        const documents = await this._collection
            .find(query, { sort: { createdAt: -1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(AttendanceCorrectionRequestMapper.toDomain);
    }

    public async findPendingByEmployeeAndDate(employeeId: string, date: Date): Promise<AttendanceCorrectionRequest | undefined> {
        const document = await this._collection.findOne(
            { employeeId, date, status: "pending" },
            this._sessionOptions,
        );
        return document ? AttendanceCorrectionRequestMapper.toDomain(document) : undefined;
    }

    public async save(request: AttendanceCorrectionRequest): Promise<void> {
        const { _id, ...body } = AttendanceCorrectionRequestMapper.toDocument(request);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }
}
