import { EMPLOYEE_COLLECTIONS } from "@modules/employee/adapters/driven/persistence/mongodb/collections";
import EmployeeContractMongoDoc from "@modules/employee/adapters/driven/persistence/mongodb/documents/EmployeeContractMongoDoc";
import EmployeeContractMapper from "@modules/employee/adapters/driven/persistence/mongodb/mappers/EmployeeContractMapper";
import MongoRepository from "@modules/employee/adapters/driven/persistence/mongodb/MongoRepository";
import EmployeeContractRepo from "@modules/employee/core/app/ports/EmployeeContractRepo";
import EmployeeContract from "@modules/employee/core/domain/entities/EmployeeContract";
import { ClientSession, Db } from "mongodb";

export default class MongoEmployeeContractRepo extends MongoRepository<EmployeeContractMongoDoc> implements EmployeeContractRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, EMPLOYEE_COLLECTIONS.contracts, session);
    }

    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<EmployeeContractMongoDoc>(EMPLOYEE_COLLECTIONS.contracts);
        await collection.createIndex({ employeeId: 1 });
        await collection.createIndex({ contractNumber: 1 }, { unique: true });
    }

    public async getById(id: string): Promise<EmployeeContract | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? EmployeeContractMapper.toDomain(document) : undefined;
    }

    public async listByEmployeeId(employeeId: string): Promise<EmployeeContract[]> {
        const documents = await this._collection.find({ employeeId }, this._sessionOptions).toArray();
        return documents.map(EmployeeContractMapper.toDomain);
    }

    public async save(contract: EmployeeContract): Promise<void> {
        const { _id, ...body } = EmployeeContractMapper.toDocument(contract);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
