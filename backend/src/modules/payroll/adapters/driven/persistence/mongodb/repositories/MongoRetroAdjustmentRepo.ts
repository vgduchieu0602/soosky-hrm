import { PAYROLL_COLLECTIONS } from "@modules/payroll/adapters/driven/persistence/mongodb/collections";
import RetroAdjustmentDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/RetroAdjustmentDocument";
import RetroAdjustmentMapper from "@modules/payroll/adapters/driven/persistence/mongodb/mappers/RetroAdjustmentMapper";
import MongoRepository from "@modules/payroll/adapters/driven/persistence/mongodb/MongoRepository";
import RetroAdjustmentRepo, { RetroListFilter } from "@modules/payroll/core/app/ports/RetroAdjustmentRepo";
import RetroAdjustment from "@modules/payroll/core/domain/entities/RetroAdjustment";
import { ClientSession, Db, Filter } from "mongodb";

export default class MongoRetroAdjustmentRepo extends MongoRepository<RetroAdjustmentDocument> implements RetroAdjustmentRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, PAYROLL_COLLECTIONS.retroAdjustments, session);
    }

    /** Index: đường nóng là "khoản còn hiệu lực của nhân viên trong kỳ chi trả" (chạy mỗi lần tính lương). */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<RetroAdjustmentDocument>(PAYROLL_COLLECTIONS.retroAdjustments);
        await collection.createIndex({ payoutPeriodId: 1, employeeId: 1, status: 1 });
        await collection.createIndex({ originPeriodId: 1 });
    }

    public async getById(id: string): Promise<RetroAdjustment | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? RetroAdjustmentMapper.toDomain(document) : undefined;
    }

    public async list(filter: RetroListFilter): Promise<RetroAdjustment[]> {
        const query: Filter<RetroAdjustmentDocument> = {};
        if (filter.employeeId != undefined)     query.employeeId = filter.employeeId;
        if (filter.payoutPeriodId != undefined) query.payoutPeriodId = filter.payoutPeriodId;
        if (filter.originPeriodId != undefined) query.originPeriodId = filter.originPeriodId;

        const documents = await this._collection
            .find(query, { sort: { createdAt: -1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(RetroAdjustmentMapper.toDomain);
    }

    public async listActiveForPayout(employeeId: string, payoutPeriodId: string): Promise<RetroAdjustment[]> {
        const documents = await this._collection
            .find({ employeeId, payoutPeriodId, status: "active" }, { sort: { createdAt: 1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(RetroAdjustmentMapper.toDomain);
    }

    public async save(adjustment: RetroAdjustment): Promise<void> {
        const { _id, ...body } = RetroAdjustmentMapper.toDocument(adjustment);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }
}
