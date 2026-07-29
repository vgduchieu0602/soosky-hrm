import { PAYROLL_COLLECTIONS } from "@modules/payroll/adapters/driven/persistence/mongodb/collections";
import PayrollPeriodDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/PayrollPeriodDocument";
import PayrollPeriodMapper from "@modules/payroll/adapters/driven/persistence/mongodb/mappers/PayrollPeriodMapper";
import MongoRepository from "@modules/payroll/adapters/driven/persistence/mongodb/MongoRepository";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";
import { ClientSession, Db } from "mongodb";

export default class MongoPayrollPeriodRepo extends MongoRepository<PayrollPeriodDocument> implements PayrollPeriodRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, PAYROLL_COLLECTIONS.periods, session);
    }

    /** Index: tên kỳ duy nhất; tra cứu theo trạng thái. */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<PayrollPeriodDocument>(PAYROLL_COLLECTIONS.periods);
        await collection.createIndex({ name: 1 }, { unique: true });
        await collection.createIndex({ status: 1 });
    }

    public async getById(id: string): Promise<PayrollPeriod | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? PayrollPeriodMapper.toDomain(document) : undefined;
    }

    public async getByName(name: string): Promise<PayrollPeriod | undefined> {
        const document = await this._collection.findOne({ name }, this._sessionOptions);
        return document ? PayrollPeriodMapper.toDomain(document) : undefined;
    }

    public async listAll(): Promise<PayrollPeriod[]> {
        const documents = await this._collection
            .find({}, { sort: { startDate: -1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(PayrollPeriodMapper.toDomain);
    }

    public async save(period: PayrollPeriod): Promise<void> {
        const { _id, ...body } = PayrollPeriodMapper.toDocument(period);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
