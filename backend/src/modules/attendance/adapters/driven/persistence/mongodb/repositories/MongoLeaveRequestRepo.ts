import { ATTENDANCE_COLLECTIONS } from "@modules/attendance/adapters/driven/persistence/mongodb/collections";
import LeaveRequestDocument from "@modules/attendance/adapters/driven/persistence/mongodb/documents/LeaveRequestDocument";
import LeaveRequestMapper from "@modules/attendance/adapters/driven/persistence/mongodb/mappers/LeaveRequestMapper";
import MongoRepository from "@modules/attendance/adapters/driven/persistence/mongodb/MongoRepository";
import LeaveRequestRepo from "@modules/attendance/core/app/ports/LeaveRequestRepo";
import LeaveRequest from "@modules/attendance/core/domain/entities/LeaveRequest";
import { ClientSession, Db } from "mongodb";

export default class MongoLeaveRequestRepo extends MongoRepository<LeaveRequestDocument> implements LeaveRequestRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, ATTENDANCE_COLLECTIONS.leaveRequests, session);
    }

    /** Index: theo (nhân viên, trạng thái) để liệt kê/kiểm tra trùng lịch nhanh. */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<LeaveRequestDocument>(ATTENDANCE_COLLECTIONS.leaveRequests);
        await collection.createIndex({ employeeId: 1, status: 1 });
        await collection.createIndex({ employeeId: 1, startDate: 1, endDate: 1 });
    }

    public async getById(id: string): Promise<LeaveRequest | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? LeaveRequestMapper.toDomain(document) : undefined;
    }

    public async listByEmployee(employeeId: string): Promise<LeaveRequest[]> {
        const documents = await this._collection
            .find({ employeeId }, { sort: { createdAt: -1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(LeaveRequestMapper.toDomain);
    }

    public async listAll(): Promise<LeaveRequest[]> {
        const documents = await this._collection
            .find({}, { sort: { createdAt: -1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(LeaveRequestMapper.toDomain);
    }

    public async listOverlapping(employeeId: string, start: Date, end: Date, statuses: string[]): Promise<LeaveRequest[]> {
        const documents = await this._collection
            .find({
                employeeId,
                status:    { $in: statuses },
                startDate: { $lte: end },
                endDate:   { $gte: start },
            }, this._sessionOptions)
            .toArray();
        return documents.map(LeaveRequestMapper.toDomain);
    }

    public async save(leaveRequest: LeaveRequest): Promise<void> {
        const { _id, ...body } = LeaveRequestMapper.toDocument(leaveRequest);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }
}
