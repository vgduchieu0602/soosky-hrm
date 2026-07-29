import { ATTENDANCE_COLLECTIONS } from "@modules/attendance/adapters/driven/persistence/mongodb/collections";
import LeaveBalanceDocument from "@modules/attendance/adapters/driven/persistence/mongodb/documents/LeaveBalanceDocument";
import LeaveBalanceMapper from "@modules/attendance/adapters/driven/persistence/mongodb/mappers/LeaveBalanceMapper";
import MongoRepository from "@modules/attendance/adapters/driven/persistence/mongodb/MongoRepository";
import LeaveBalanceRepo from "@modules/attendance/core/app/ports/LeaveBalanceRepo";
import LeaveBalance from "@modules/attendance/core/domain/entities/LeaveBalance";
import { ClientSession, Db } from "mongodb";

export default class MongoLeaveBalanceRepo extends MongoRepository<LeaveBalanceDocument> implements LeaveBalanceRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, ATTENDANCE_COLLECTIONS.leaveBalances, session);
    }

    /** Index: một dòng số dư duy nhất cho mỗi (nhân viên, loại nghỉ, năm). */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<LeaveBalanceDocument>(ATTENDANCE_COLLECTIONS.leaveBalances);
        await collection.createIndex({ employeeId: 1, leaveType: 1, year: 1 }, { unique: true });
    }

    public async getById(id: string): Promise<LeaveBalance | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? LeaveBalanceMapper.toDomain(document) : undefined;
    }

    public async getOne(employeeId: string, leaveType: string, year: number): Promise<LeaveBalance | undefined> {
        const document = await this._collection.findOne({ employeeId, leaveType, year }, this._sessionOptions);
        return document ? LeaveBalanceMapper.toDomain(document) : undefined;
    }

    public async listInYearWindow(employeeId: string, leaveType: string, from: number, to: number): Promise<LeaveBalance[]> {
        const documents = await this._collection
            .find({ employeeId, leaveType, year: { $gte: from, $lte: to } }, this._sessionOptions)
            .toArray();
        return documents.map(LeaveBalanceMapper.toDomain);
    }

    public async listByEmployeeYear(employeeId: string, year: number): Promise<LeaveBalance[]> {
        const documents = await this._collection
            .find({ employeeId, year }, this._sessionOptions)
            .toArray();
        return documents.map(LeaveBalanceMapper.toDomain);
    }

    public async save(leaveBalance: LeaveBalance): Promise<void> {
        const { _id, ...body } = LeaveBalanceMapper.toDocument(leaveBalance);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }
}
