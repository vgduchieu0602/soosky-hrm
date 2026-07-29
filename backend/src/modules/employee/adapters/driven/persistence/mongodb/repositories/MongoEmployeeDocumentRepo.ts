import { EMPLOYEE_COLLECTIONS } from "@modules/employee/adapters/driven/persistence/mongodb/collections";
import EmployeeDocumentMongoDoc from "@modules/employee/adapters/driven/persistence/mongodb/documents/EmployeeDocumentMongoDoc";
import EmployeeDocumentMapper from "@modules/employee/adapters/driven/persistence/mongodb/mappers/EmployeeDocumentMapper";
import MongoRepository from "@modules/employee/adapters/driven/persistence/mongodb/MongoRepository";
import EmployeeDocumentRepo from "@modules/employee/core/app/ports/EmployeeDocumentRepo";
import EmployeeDocument from "@modules/employee/core/domain/entities/EmployeeDocument";
import { ClientSession, Db } from "mongodb";

export default class MongoEmployeeDocumentRepo extends MongoRepository<EmployeeDocumentMongoDoc> implements EmployeeDocumentRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, EMPLOYEE_COLLECTIONS.documents, session);
    }

    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<EmployeeDocumentMongoDoc>(EMPLOYEE_COLLECTIONS.documents);
        await collection.createIndex({ employeeId: 1 });
    }

    public async getById(id: string): Promise<EmployeeDocument | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? EmployeeDocumentMapper.toDomain(document) : undefined;
    }

    public async listByEmployeeId(employeeId: string): Promise<EmployeeDocument[]> {
        const documents = await this._collection.find({ employeeId }, this._sessionOptions).toArray();
        return documents.map(EmployeeDocumentMapper.toDomain);
    }

    public async save(document: EmployeeDocument): Promise<void> {
        const { _id, ...body } = EmployeeDocumentMapper.toDocument(document);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
