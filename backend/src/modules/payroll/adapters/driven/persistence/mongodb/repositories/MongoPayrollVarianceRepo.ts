import { PAYROLL_COLLECTIONS } from "@modules/payroll/adapters/driven/persistence/mongodb/collections";
import PayrollVarianceDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/PayrollVarianceDocument";
import PayrollVarianceMapper from "@modules/payroll/adapters/driven/persistence/mongodb/mappers/PayrollVarianceMapper";
import MongoRepository from "@modules/payroll/adapters/driven/persistence/mongodb/MongoRepository";
import PayrollVarianceRepo from "@modules/payroll/core/app/ports/PayrollVarianceRepo";
import PayrollVariance from "@modules/payroll/core/domain/entities/PayrollVariance";
import { ClientSession, Db } from "mongodb";

export default class MongoPayrollVarianceRepo extends MongoRepository<PayrollVarianceDocument> implements PayrollVarianceRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, PAYROLL_COLLECTIONS.variances, session);
    }

    /** Index: một bản ghi chênh lệch duy nhất mỗi (kỳ, nhân viên). */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<PayrollVarianceDocument>(PAYROLL_COLLECTIONS.variances);
        await collection.createIndex({ payrollPeriodId: 1, employeeId: 1 }, { unique: true });
        await collection.createIndex({ payrollPeriodId: 1, signedAt: 1 });
    }

    public async listByPeriod(payrollPeriodId: string): Promise<PayrollVariance[]> {
        const documents = await this._collection
            .find({ payrollPeriodId }, { sort: { employeeId: 1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(PayrollVarianceMapper.toDomain);
    }

    public async findOne(payrollPeriodId: string, employeeId: string): Promise<PayrollVariance | undefined> {
        const document = await this._collection.findOne({ payrollPeriodId, employeeId }, this._sessionOptions);
        return document ? PayrollVarianceMapper.toDomain(document) : undefined;
    }

    public async countUnsigned(payrollPeriodId: string): Promise<number> {
        return this._collection.countDocuments({ payrollPeriodId, signedAt: null }, this._sessionOptions);
    }

    public async save(variance: PayrollVariance): Promise<void> {
        const { _id, ...body } = PayrollVarianceMapper.toDocument(variance);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteOne(payrollPeriodId: string, employeeId: string): Promise<void> {
        await this._collection.deleteOne({ payrollPeriodId, employeeId }, this._sessionOptions);
    }
}
