import { PAYROLL_COLLECTIONS } from "@modules/payroll/adapters/driven/persistence/mongodb/collections";
import BonusDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/BonusDocument";
import BonusMapper from "@modules/payroll/adapters/driven/persistence/mongodb/mappers/BonusMapper";
import MongoRepository from "@modules/payroll/adapters/driven/persistence/mongodb/MongoRepository";
import BonusRepo from "@modules/payroll/core/app/ports/BonusRepo";
import Bonus from "@modules/payroll/core/domain/entities/Bonus";
import { ClientSession, Db } from "mongodb";

export default class MongoBonusRepo extends MongoRepository<BonusDocument> implements BonusRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, PAYROLL_COLLECTIONS.bonuses, session);
    }

    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<BonusDocument>(PAYROLL_COLLECTIONS.bonuses);
        await collection.createIndex({ employeeId: 1, payrollPeriodId: 1 });
    }

    public async getById(id: string): Promise<Bonus | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? BonusMapper.toDomain(document) : undefined;
    }

    public async listByEmployeeId(employeeId: string): Promise<Bonus[]> {
        const documents = await this._collection.find({ employeeId }, this._sessionOptions).toArray();
        return documents.map(BonusMapper.toDomain);
    }

    public async listForPeriod(employeeId: string, payrollPeriodId: string): Promise<Bonus[]> {
        const documents = await this._collection.find({ employeeId, payrollPeriodId }, this._sessionOptions).toArray();
        return documents.map(BonusMapper.toDomain);
    }

    public async save(bonus: Bonus): Promise<void> {
        const { _id, ...body } = BonusMapper.toDocument(bonus);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
