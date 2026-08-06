import PayrollVarianceRepo from "@modules/payroll/core/app/ports/PayrollVarianceRepo";
import PayrollVariance from "@modules/payroll/core/domain/entities/PayrollVariance";

/** Repo chênh lệch đối soát trong bộ nhớ — khoá theo (kỳ, nhân viên) như index thật. */
export default class InMemoryPayrollVarianceRepo implements PayrollVarianceRepo {
    private readonly _store = new Map<string, PayrollVariance>();

    private _key(periodId: string, employeeId: string): string {
        return `${periodId}::${employeeId}`;
    }

    async listByPeriod(payrollPeriodId: string): Promise<PayrollVariance[]> {
        return [...this._store.values()].filter(row => row.payrollPeriodId === payrollPeriodId);
    }

    async findOne(payrollPeriodId: string, employeeId: string): Promise<PayrollVariance | undefined> {
        return this._store.get(this._key(payrollPeriodId, employeeId));
    }

    async countUnsigned(payrollPeriodId: string): Promise<number> {
        return (await this.listByPeriod(payrollPeriodId)).filter(row => !row.isSigned).length;
    }

    async save(variance: PayrollVariance): Promise<void> {
        this._store.set(this._key(variance.payrollPeriodId, variance.employeeId), variance);
    }

    async deleteOne(payrollPeriodId: string, employeeId: string): Promise<void> {
        this._store.delete(this._key(payrollPeriodId, employeeId));
    }
}
