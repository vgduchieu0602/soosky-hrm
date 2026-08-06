import { ATTENDANCE_COLLECTIONS } from "@modules/attendance/adapters/driven/persistence/mongodb/collections";
import LeaveRequestDocument from "@modules/attendance/adapters/driven/persistence/mongodb/documents/LeaveRequestDocument";
import LeaveRequestMapper from "@modules/attendance/adapters/driven/persistence/mongodb/mappers/LeaveRequestMapper";
import MongoRepository from "@modules/attendance/adapters/driven/persistence/mongodb/MongoRepository";
import LeaveRequestRepo, { LeaveListFilter } from "@modules/attendance/core/app/ports/LeaveRequestRepo";
import LeaveRequest from "@modules/attendance/core/domain/entities/LeaveRequest";
import { ClientSession, Db, Filter } from "mongodb";

export default class MongoLeaveRequestRepo extends MongoRepository<LeaveRequestDocument> implements LeaveRequestRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, ATTENDANCE_COLLECTIONS.leaveRequests, session);
    }

    /** Index: theo (nhân viên, trạng thái) để liệt kê/kiểm tra trùng lịch nhanh. */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<LeaveRequestDocument>(ATTENDANCE_COLLECTIONS.leaveRequests);
        await collection.createIndex({ employeeId: 1, status: 1 });
        await collection.createIndex({ employeeId: 1, startDate: 1, endDate: 1 });
        // Hàng chờ duyệt của bảng điều khiển lọc theo trạng thái + ngày bắt đầu cho
        // NHIỀU nhân viên, nên `employeeId` không dẫn đường được.
        await collection.createIndex({ status: 1, startDate: 1 });
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

    public async list(filter: LeaveListFilter): Promise<LeaveRequest[]> {
        const query: Filter<LeaveRequestDocument> = {};
        if (filter.employeeIds != undefined) query.employeeId = { $in: [...filter.employeeIds] };
        if (filter.status != undefined)      query.status = filter.status;
        if (filter.startFrom != undefined)   query.startDate = { $gte: filter.startFrom };

        const documents = await this._collection
            .find(query, { sort: { startDate: 1 }, ...this._sessionOptions })
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
