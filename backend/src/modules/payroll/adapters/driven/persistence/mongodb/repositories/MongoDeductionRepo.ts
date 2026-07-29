import { PAYROLL_COLLECTIONS } from "@modules/payroll/adapters/driven/persistence/mongodb/collections";
import DeductionDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/DeductionDocument";
import DeductionMapper from "@modules/payroll/adapters/driven/persistence/mongodb/mappers/DeductionMapper";
import MongoRepository from "@modules/payroll/adapters/driven/persistence/mongodb/MongoRepository";
import DeductionRepo from "@modules/payroll/core/app/ports/DeductionRepo";
import Deduction from "@modules/payroll/core/domain/entities/Deduction";
import { ClientSession, Db } from "mongodb";

export default class MongoDeductionRepo extends MongoRepository<DeductionDocument> implements DeductionRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, PAYROLL_COLLECTIONS.deductions, session);
    }

    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<DeductionDocument>(PAYROLL_COLLECTIONS.deductions);
        await collection.createIndex({ employeeId: 1, payrollPeriodId: 1 });
    }

    public async getById(id: string): Promise<Deduction | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? DeductionMapper.toDomain(document) : undefined;
    }

    public async listByEmployeeId(employeeId: string): Promise<Deduction[]> {
        const documents = await this._collection.find({ employeeId }, this._sessionOptions).toArray();
        return documents.map(DeductionMapper.toDomain);
    }

    public async listApplicableForPeriod(employeeId: string, payrollPeriodId: string, periodStart: Date, periodEnd: Date): Promise<Deduction[]> {
        const all = await this.listByEmployeeId(employeeId);
        return all.filter(d => d.appliesToPeriod(payrollPeriodId, periodStart, periodEnd));
    }

    public async save(deduction: Deduction): Promise<void> {
        const { _id, ...body } = DeductionMapper.toDocument(deduction);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
