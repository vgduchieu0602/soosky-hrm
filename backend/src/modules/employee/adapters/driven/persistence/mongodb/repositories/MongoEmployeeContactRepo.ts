import { EMPLOYEE_COLLECTIONS } from "@modules/employee/adapters/driven/persistence/mongodb/collections";
import EmployeeContactMongoDoc from "@modules/employee/adapters/driven/persistence/mongodb/documents/EmployeeContactMongoDoc";
import EmployeeContactMapper from "@modules/employee/adapters/driven/persistence/mongodb/mappers/EmployeeContactMapper";
import MongoRepository from "@modules/employee/adapters/driven/persistence/mongodb/MongoRepository";
import EmployeeContactRepo from "@modules/employee/core/app/ports/EmployeeContactRepo";
import EmployeeContact from "@modules/employee/core/domain/entities/EmployeeContact";
import { ClientSession, Db } from "mongodb";

export default class MongoEmployeeContactRepo extends MongoRepository<EmployeeContactMongoDoc> implements EmployeeContactRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, EMPLOYEE_COLLECTIONS.contacts, session);
    }

    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<EmployeeContactMongoDoc>(EMPLOYEE_COLLECTIONS.contacts);
        await collection.createIndex({ employeeId: 1 });
    }

    public async getById(id: string): Promise<EmployeeContact | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? EmployeeContactMapper.toDomain(document) : undefined;
    }

    public async listByEmployeeId(employeeId: string): Promise<EmployeeContact[]> {
        const documents = await this._collection.find({ employeeId }, this._sessionOptions).toArray();
        return documents.map(EmployeeContactMapper.toDomain);
    }

    public async save(contact: EmployeeContact): Promise<void> {
        const { _id, ...body } = EmployeeContactMapper.toDocument(contact);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
