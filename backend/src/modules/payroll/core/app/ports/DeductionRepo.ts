import Deduction from "@modules/payroll/core/domain/entities/Deduction";

export default interface DeductionRepo {
    getById(id: string): Promise<Deduction | undefined>;
    listByEmployeeId(employeeId: string): Promise<Deduction[]>;
    /** Khấu trừ một-lần đúng kỳ + khấu trừ lặp lại còn hiệu lực trong kỳ. */
    listApplicableForPeriod(employeeId: string, payrollPeriodId: string, periodStart: Date, periodEnd: Date): Promise<Deduction[]>;
    save(deduction: Deduction): Promise<void>;
    deleteById(id: string): Promise<void>;
}
