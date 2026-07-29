import { EMPLOYEE_COLLECTIONS } from "@modules/employee/adapters/driven/persistence/mongodb/collections";
import EmployeeBankAccountMongoDoc from "@modules/employee/adapters/driven/persistence/mongodb/documents/EmployeeBankAccountMongoDoc";
import EmployeeBankAccountMapper from "@modules/employee/adapters/driven/persistence/mongodb/mappers/EmployeeBankAccountMapper";
import MongoRepository from "@modules/employee/adapters/driven/persistence/mongodb/MongoRepository";
import EmployeeBankAccountRepo from "@modules/employee/core/app/ports/EmployeeBankAccountRepo";
import EmployeeBankAccount from "@modules/employee/core/domain/entities/EmployeeBankAccount";
import { ClientSession, Db } from "mongodb";

export default class MongoEmployeeBankAccountRepo extends MongoRepository<EmployeeBankAccountMongoDoc> implements EmployeeBankAccountRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, EMPLOYEE_COLLECTIONS.bankAccounts, session);
    }

    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<EmployeeBankAccountMongoDoc>(EMPLOYEE_COLLECTIONS.bankAccounts);
        await collection.createIndex({ employeeId: 1 });
    }

    public async getById(id: string): Promise<EmployeeBankAccount | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? EmployeeBankAccountMapper.toDomain(document) : undefined;
    }

    public async listByEmployeeId(employeeId: string): Promise<EmployeeBankAccount[]> {
        const documents = await this._collection.find({ employeeId }, this._sessionOptions).toArray();
        return documents.map(EmployeeBankAccountMapper.toDomain);
    }

    public async save(account: EmployeeBankAccount): Promise<void> {
        const { _id, ...body } = EmployeeBankAccountMapper.toDocument(account);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
