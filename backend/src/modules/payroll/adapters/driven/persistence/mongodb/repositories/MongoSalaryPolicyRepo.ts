import { PAYROLL_COLLECTIONS } from "@modules/payroll/adapters/driven/persistence/mongodb/collections";
import SalaryPolicyDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/SalaryPolicyDocument";
import SalaryPolicyMapper from "@modules/payroll/adapters/driven/persistence/mongodb/mappers/SalaryPolicyMapper";
import MongoRepository from "@modules/payroll/adapters/driven/persistence/mongodb/MongoRepository";
import SalaryPolicyRepo from "@modules/payroll/core/app/ports/SalaryPolicyRepo";
import SalaryPolicy from "@modules/payroll/core/domain/entities/SalaryPolicy";
import { ClientSession, Db } from "mongodb";

export default class MongoSalaryPolicyRepo extends MongoRepository<SalaryPolicyDocument> implements SalaryPolicyRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, PAYROLL_COLLECTIONS.policies, session);
    }

    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<SalaryPolicyDocument>(PAYROLL_COLLECTIONS.policies);
        await collection.createIndex({ effectiveFrom: -1 });
    }

    public async listAll(): Promise<SalaryPolicy[]> {
        const documents = await this._collection
            .find({}, { sort: { effectiveFrom: -1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(SalaryPolicyMapper.toDomain);
    }

    public async findEffectiveAt(date: Date): Promise<SalaryPolicy | undefined> {
        const all = await this.listAll();
        return all.find(p => p.effectiveFrom <= date);
    }

    public async save(policy: SalaryPolicy): Promise<void> {
        const { _id, ...body } = SalaryPolicyMapper.toDocument(policy);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }
}
