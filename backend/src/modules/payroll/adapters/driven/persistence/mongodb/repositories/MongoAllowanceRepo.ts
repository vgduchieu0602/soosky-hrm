import { PAYROLL_COLLECTIONS } from "@modules/payroll/adapters/driven/persistence/mongodb/collections";
import AllowanceDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/AllowanceDocument";
import AllowanceMapper from "@modules/payroll/adapters/driven/persistence/mongodb/mappers/AllowanceMapper";
import MongoRepository from "@modules/payroll/adapters/driven/persistence/mongodb/MongoRepository";
import AllowanceRepo from "@modules/payroll/core/app/ports/AllowanceRepo";
import Allowance from "@modules/payroll/core/domain/entities/Allowance";
import { ClientSession, Db } from "mongodb";

export default class MongoAllowanceRepo extends MongoRepository<AllowanceDocument> implements AllowanceRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, PAYROLL_COLLECTIONS.allowances, session);
    }

    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<AllowanceDocument>(PAYROLL_COLLECTIONS.allowances);
        await collection.createIndex({ employeeId: 1, effectiveDate: -1 });
    }

    public async getById(id: string): Promise<Allowance | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? AllowanceMapper.toDomain(document) : undefined;
    }

    public async listByEmployeeId(employeeId: string): Promise<Allowance[]> {
        const documents = await this._collection
            .find({ employeeId }, { sort: { effectiveDate: -1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(AllowanceMapper.toDomain);
    }

    public async save(allowance: Allowance): Promise<void> {
        const { _id, ...body } = AllowanceMapper.toDocument(allowance);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
