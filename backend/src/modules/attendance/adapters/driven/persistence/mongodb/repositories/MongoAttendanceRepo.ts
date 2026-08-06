import { ATTENDANCE_COLLECTIONS } from "@modules/attendance/adapters/driven/persistence/mongodb/collections";
import AttendanceDocument from "@modules/attendance/adapters/driven/persistence/mongodb/documents/AttendanceDocument";
import AttendanceMapper from "@modules/attendance/adapters/driven/persistence/mongodb/mappers/AttendanceMapper";
import MongoRepository from "@modules/attendance/adapters/driven/persistence/mongodb/MongoRepository";
import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import Attendance from "@modules/attendance/core/domain/entities/Attendance";
import AttendanceSession from "@modules/attendance/core/domain/value-objects/AttendanceSession";
import { ClientSession, Db } from "mongodb";

export default class MongoAttendanceRepo extends MongoRepository<AttendanceDocument> implements AttendanceRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, ATTENDANCE_COLLECTIONS.attendances, session);
    }

    /** Index: một bản ghi duy nhất cho mỗi (nhân viên, ngày, ca); index theo khoảng ngày để liệt kê. */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<AttendanceDocument>(ATTENDANCE_COLLECTIONS.attendances);
        await collection.createIndex({ employeeId: 1, date: 1, shiftId: 1 }, { unique: true });
        await collection.createIndex({ leaveRequestId: 1 });
        // Bảng điều khiển đếm theo KHOẢNG NGÀY cho mọi nhân viên (không có employeeId
        // dẫn đường), nên cần index riêng trên `date`.
        await collection.createIndex({ date: 1 });
    }

    public async getById(id: string): Promise<Attendance | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? AttendanceMapper.toDomain(document) : undefined;
    }

    public async getBySlot(employeeId: string, date: Date, shiftId: string): Promise<Attendance | undefined> {
        const document = await this._collection.findOne({ employeeId, date, shiftId }, this._sessionOptions);
        return document ? AttendanceMapper.toDomain(document) : undefined;
    }

    public async listByEmployeeAndRange(employeeId: string, start: Date, end: Date): Promise<Attendance[]> {
        const documents = await this._collection
            .find({ employeeId, date: { $gte: start, $lte: end } }, { sort: { date: 1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(AttendanceMapper.toDomain);
    }

    /**
     * Đếm bản ghi theo trạng thái, GOM THEO NGÀY, trong một khoảng.
     *
     * Gom bằng aggregate của Mongo thay vì tải hết bản ghi rồi đếm trong Node:
     * 30 ngày × toàn công ty là hàng chục nghìn document, không cần chuyển hết
     * qua tiến trình app chỉ để cộng.
     */
    public async countByStatusPerDay(
        start: Date,
        end: Date,
        employeeIds?: readonly string[] | undefined,
    ): Promise<{ date: Date; status: string; count: number; employeeIds: string[] }[]> {
        const rows = await this._collection.aggregate<{
            _id:         { date: Date; status: string };
            count:       number;
            employeeIds: string[];
        }>([
            {
                $match: {
                    date: { $gte: start, $lte: end },
                    ...(employeeIds == undefined ? {} : { employeeId: { $in: [...employeeIds] } }),
                },
            },
            {
                $group: {
                    _id:         { date: "$date", status: "$status" },
                    count:       { $sum: 1 },
                    employeeIds: { $addToSet: "$employeeId" },
                },
            },
        ], this._sessionOptions).toArray();

        return rows.map(row => ({
            date:        row._id.date,
            status:      row._id.status,
            count:       row.count,
            employeeIds: row.employeeIds,
        }));
    }

    public async listByRange(start: Date, end: Date, employeeIds?: string[] | undefined): Promise<Attendance[]> {
        const documents = await this._collection
            .find(
                {
                    date: { $gte: start, $lte: end },
                    ...(employeeIds == undefined ? {} : { employeeId: { $in: employeeIds } }),
                },
                { sort: { date: 1 }, ...this._sessionOptions },
            )
            .toArray();
        return documents.map(AttendanceMapper.toDomain);
    }

    public async findFullDayLeave(employeeId: string, date: Date): Promise<Attendance | undefined> {
        const document = await this._collection.findOne(
            { employeeId, date, source: "leave", session: AttendanceSession.FULL_DAY.value },
            this._sessionOptions,
        );
        return document ? AttendanceMapper.toDomain(document) : undefined;
    }

    public async save(attendance: Attendance): Promise<void> {
        const { _id, ...body } = AttendanceMapper.toDocument(attendance);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }

    public async deleteByLeaveRequestId(leaveRequestId: string): Promise<void> {
        await this._collection.deleteMany({ leaveRequestId }, this._sessionOptions);
    }
}
