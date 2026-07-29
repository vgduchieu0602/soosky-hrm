import MongoPayrollPeriodRepo from "@modules/payroll/adapters/driven/persistence/mongodb/repositories/MongoPayrollPeriodRepo";
import MongoPayslipRepo from "@modules/payroll/adapters/driven/persistence/mongodb/repositories/MongoPayslipRepo";
import UnitOfWork, { PayrollUoWContext } from "@modules/payroll/core/app/ports/UnitOfWork";
import { Db, MongoClient } from "mongodb";

/**
 * `UnitOfWork` cho module Payroll trên MongoDB. Mở một `ClientSession`, chạy
 * callback bên trong một transaction (`withTransaction` tự commit khi thành
 * công và rollback khi có lỗi), cấp cho callback bộ repo đã gắn session — nên
 * mọi ghi trong `run` (tính lương, duyệt, thanh toán) là nguyên tử.
 *
 * Lưu ý: transaction MongoDB yêu cầu deployment dạng replica set (hoặc sharded cluster).
 */
export default class MongoUnitOfWork implements UnitOfWork {
    public constructor(
        private readonly _client: MongoClient,
        private readonly _db: Db,
    ) {}

    public async run<T>(work: (ctx: PayrollUoWContext) => Promise<T>): Promise<T> {
        const session = this._client.startSession();
        try {
            let result!: T;
            await session.withTransaction(async () => {
                const ctx: PayrollUoWContext = {
                    periodRepo:  new MongoPayrollPeriodRepo(this._db, session),
                    payslipRepo: new MongoPayslipRepo(this._db, session),
                };
                result = await work(ctx);
            });
            return result;
        } finally {
            await session.endSession();
        }
    }
}
