import { PERFORMANCE_COLLECTIONS } from "@modules/performance/adapters/driven/persistence/mongodb/collections";
import AppraisalCycleDocument from "@modules/performance/adapters/driven/persistence/mongodb/documents/AppraisalCycleDocument";
import AppraisalCycleMapper from "@modules/performance/adapters/driven/persistence/mongodb/mappers/AppraisalCycleMapper";
import MongoRepository from "@modules/performance/adapters/driven/persistence/mongodb/MongoRepository";
import AppraisalCycleRepo from "@modules/performance/core/app/ports/AppraisalCycleRepo";
import AppraisalCycle from "@modules/performance/core/domain/entities/AppraisalCycle";
import { ClientSession, Db } from "mongodb";

export default class MongoAppraisalCycleRepo extends MongoRepository<AppraisalCycleDocument> implements AppraisalCycleRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, PERFORMANCE_COLLECTIONS.cycles, session);
    }

    /**
     * `payrollPeriodId` UNIQUE: một kỳ lương chỉ được một chu kỳ đánh giá. Kiểm
     * tra ở use-case là để báo lỗi rõ ràng; index này là chốt chặn cuối khi hai
     * request tạo cùng lúc.
     */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<AppraisalCycleDocument>(PERFORMANCE_COLLECTIONS.cycles);
        await collection.createIndex({ payrollPeriodId: 1 }, { unique: true });
        await collection.createIndex({ status: 1, createdAt: -1 });
    }

    public async getById(id: string): Promise<AppraisalCycle | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? AppraisalCycleMapper.toDomain(document) : undefined;
    }

    public async findByPayrollPeriodId(payrollPeriodId: string): Promise<AppraisalCycle | undefined> {
        const document = await this._collection.findOne({ payrollPeriodId }, this._sessionOptions);
        return document ? AppraisalCycleMapper.toDomain(document) : undefined;
    }

    public async listAll(): Promise<AppraisalCycle[]> {
        const documents = await this._collection
            .find({}, { sort: { createdAt: -1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(AppraisalCycleMapper.toDomain);
    }

    public async save(cycle: AppraisalCycle): Promise<void> {
        const { _id, ...body } = AppraisalCycleMapper.toDocument(cycle);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }
}
