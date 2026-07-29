import { EMPLOYEE_COLLECTIONS } from "@modules/employee/adapters/driven/persistence/mongodb/collections";
import EmployeeMongoDoc from "@modules/employee/adapters/driven/persistence/mongodb/documents/EmployeeMongoDoc";
import EmployeeMapper from "@modules/employee/adapters/driven/persistence/mongodb/mappers/EmployeeMapper";
import MongoRepository from "@modules/employee/adapters/driven/persistence/mongodb/MongoRepository";
import EmployeeRepo, { EmployeeListFilter } from "@modules/employee/core/app/ports/EmployeeRepo";
import Employee from "@modules/employee/core/domain/entities/Employee";
import { ClientSession, Db } from "mongodb";

export default class MongoEmployeeRepo extends MongoRepository<EmployeeMongoDoc> implements EmployeeRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, EMPLOYEE_COLLECTIONS.employees, session);
    }

    /** Index: mã nhân viên là duy nhất; index theo phòng ban/trạng thái để liệt kê. */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<EmployeeMongoDoc>(EMPLOYEE_COLLECTIONS.employees);
        await collection.createIndex({ code: 1 }, { unique: true });
        await collection.createIndex({ departmentId: 1 });
        await collection.createIndex({ status: 1 });
    }

    public async getById(id: string): Promise<Employee | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? EmployeeMapper.toDomain(document) : undefined;
    }

    public async getByCode(code: string): Promise<Employee | undefined> {
        const document = await this._collection.findOne({ code }, this._sessionOptions);
        return document ? EmployeeMapper.toDomain(document) : undefined;
    }

    public async list(filter: EmployeeListFilter): Promise<Employee[]> {
        const query: Record<string, unknown> = {};
        if (filter.departmentId != undefined) query.departmentId = filter.departmentId;
        if (filter.status != undefined) query.status = filter.status;

        const documents = await this._collection
            .find(query, { sort: { createdAt: 1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(EmployeeMapper.toDomain);
    }

    public async save(employee: Employee): Promise<void> {
        const { _id, ...body } = EmployeeMapper.toDocument(employee);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }

    public async deleteById(id: string): Promise<void> {
        await this._collection.deleteOne({ _id: id }, this._sessionOptions);
    }
}
