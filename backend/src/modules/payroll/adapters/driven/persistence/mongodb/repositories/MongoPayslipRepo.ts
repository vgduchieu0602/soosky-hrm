import { PAYROLL_COLLECTIONS } from "@modules/payroll/adapters/driven/persistence/mongodb/collections";
import PayslipDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/PayslipDocument";
import PayslipMapper from "@modules/payroll/adapters/driven/persistence/mongodb/mappers/PayslipMapper";
import MongoRepository from "@modules/payroll/adapters/driven/persistence/mongodb/MongoRepository";
import PayslipRepo, { PayslipListFilter, PayslipTotalsRow } from "@modules/payroll/core/app/ports/PayslipRepo";
import Payslip, { PayslipStatus } from "@modules/payroll/core/domain/entities/Payslip";
import { ClientSession, Db, Filter } from "mongodb";

export default class MongoPayslipRepo extends MongoRepository<PayslipDocument> implements PayslipRepo {
    public constructor(db: Db, session?: ClientSession) {
        super(db, PAYROLL_COLLECTIONS.payslips, session);
    }

    /** Index: một dòng lương duy nhất mỗi (kỳ, nhân viên); tra cứu theo kỳ/nhân viên/trạng thái. */
    public static async ensureIndexes(db: Db): Promise<void> {
        const collection = db.collection<PayslipDocument>(PAYROLL_COLLECTIONS.payslips);
        await collection.createIndex({ payrollPeriodId: 1, employeeId: 1 }, { unique: true });
        await collection.createIndex({ employeeId: 1, status: 1 });
        await collection.createIndex({ payrollPeriodId: 1, status: 1 });
    }

    public async getById(id: string): Promise<Payslip | undefined> {
        const document = await this._collection.findOne({ _id: id }, this._sessionOptions);
        return document ? PayslipMapper.toDomain(document) : undefined;
    }

    public async findOne(payrollPeriodId: string, employeeId: string): Promise<Payslip | undefined> {
        const document = await this._collection.findOne({ payrollPeriodId, employeeId }, this._sessionOptions);
        return document ? PayslipMapper.toDomain(document) : undefined;
    }

    public async listByPeriod(payrollPeriodId: string): Promise<Payslip[]> {
        const documents = await this._collection.find({ payrollPeriodId }, this._sessionOptions).toArray();
        return documents.map(PayslipMapper.toDomain);
    }

    public async listByPeriodAndStatus(payrollPeriodId: string, status: PayslipStatus, employeeId?: string): Promise<Payslip[]> {
        const query: Filter<PayslipDocument> = { payrollPeriodId, status, ...(employeeId != undefined ? { employeeId } : {}) };
        const documents = await this._collection.find(query, this._sessionOptions).toArray();
        return documents.map(PayslipMapper.toDomain);
    }

    public async listFinalizedByEmployee(employeeId: string): Promise<Payslip[]> {
        const documents = await this._collection
            .find({ employeeId, status: { $ne: "draft" } }, { sort: { computedAt: -1 }, ...this._sessionOptions })
            .toArray();
        return documents.map(PayslipMapper.toDomain);
    }

    public async paginate(filter: PayslipListFilter, page: number, limit: number): Promise<{ items: Payslip[]; total: number }> {
        const query: Filter<PayslipDocument> = {
            ...(filter.payrollPeriodId != undefined ? { payrollPeriodId: filter.payrollPeriodId } : {}),
            ...(filter.employeeId != undefined ? { employeeId: filter.employeeId } : {}),
            ...(filter.status != undefined ? { status: filter.status } : {}),
        };
        const skip = Math.max(0, (page - 1) * limit);
        const [documents, total] = await Promise.all([
            this._collection.find(query, { sort: { createdAt: -1 }, skip, limit, ...this._sessionOptions }).toArray(),
            this._collection.countDocuments(query, this._sessionOptions),
        ]);
        return { items: documents.map(PayslipMapper.toDomain), total };
    }

    public async totalsForPeriod(payrollPeriodId: string): Promise<PayslipTotalsRow[]> {
        const rows = await this._collection.aggregate<{ _id: PayslipStatus; count: number; gross: number; net: number }>([
            { $match: { payrollPeriodId } },
            { $group: { _id: "$status", count: { $sum: 1 }, gross: { $sum: "$breakdown.grossSalary" }, net: { $sum: "$breakdown.netSalary" } } },
        ], this._sessionOptions).toArray();
        return rows.map(r => ({ status: r._id, count: r.count, gross: r.gross, net: r.net }));
    }

    public async countByPeriod(payrollPeriodId: string): Promise<number> {
        return this._collection.countDocuments({ payrollPeriodId }, this._sessionOptions);
    }

    public async countByStatus(payrollPeriodId: string, status: PayslipStatus): Promise<number> {
        return this._collection.countDocuments({ payrollPeriodId, status }, this._sessionOptions);
    }

    public async save(payslip: Payslip): Promise<void> {
        const { _id, ...body } = PayslipMapper.toDocument(payslip);
        await this._collection.replaceOne({ _id }, body, { upsert: true, ...this._sessionOptions });
    }
}
