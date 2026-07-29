import Bonus from "@modules/payroll/core/domain/entities/Bonus";

export default interface BonusRepo {
    getById(id: string): Promise<Bonus | undefined>;
    listByEmployeeId(employeeId: string): Promise<Bonus[]>;
    listForPeriod(employeeId: string, payrollPeriodId: string): Promise<Bonus[]>;
    save(bonus: Bonus): Promise<void>;
    deleteById(id: string): Promise<void>;
}
