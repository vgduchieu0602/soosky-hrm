import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";
import PayslipRepo from "@modules/payroll/core/app/ports/PayslipRepo";

/** Bộ repo gắn session, cấp cho callback chạy trong một transaction (xem `MongoUnitOfWork`). */
export interface PayrollUoWContext {
    periodRepo:  PayrollPeriodRepo;
    payslipRepo: PayslipRepo;
}

export default interface UnitOfWork {
    run<T>(work: (ctx: PayrollUoWContext) => Promise<T>): Promise<T>;
}
