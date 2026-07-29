import { PAYROLL_COLLECTIONS } from "@modules/payroll/adapters/driven/persistence/mongodb/collections";
import TaxProfileDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/TaxProfileDocument";
import TaxProfileMapper from "@modules/payroll/adapters/driven/persistence/mongodb/mappers/TaxProfileMapper";
import MongoRepository from "@modules/payroll/adapters/driven/persistence/mongodb/MongoRepository";
import TaxProfileRepo from "@modules/payroll/core/app/ports/TaxProfileRepo";
import TaxProfile from "@modules/payroll/core/domain/entities/TaxProfile";
import { ClientSession, Db } from "mongodb";

export default class MongoTaxProfileRepo extends MongoRepository<TaxProfileDocument> implements TaxProfileRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, PAYROLL_COLLECTIONS.taxProfiles, session);
    }

    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<TaxProfileDocument>(PAYROLL_COLLECTIONS.taxProfiles);
        await collection.createIndex({ employeeId: 1, effectiveDate: -1 });
    }

    public async listByEmployeeId(employeeId: string): Promise<TaxProfile[]> {
        const documents = await this._collection
            .find({ employeeId }, { sort: { effectiveDate: -1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(TaxProfileMapper.toDomain);
    }

    public async findEffectiveAt(employeeId: string, date: Date): Promise<TaxProfile | undefined> {
        const all = await this.listByEmployeeId(employeeId);
        return all.find(p => p.isActiveAt(date));
    }

    public async save(taxProfile: TaxProfile): Promise<void> {
        const { _id, ...body } = TaxProfileMapper.toDocument(taxProfile);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }
}
