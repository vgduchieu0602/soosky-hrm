import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";

export default interface PayrollPeriodRepo {
    getById(id: string): Promise<PayrollPeriod | undefined>;
    getByName(name: string): Promise<PayrollPeriod | undefined>;
    listAll(): Promise<PayrollPeriod[]>;
    save(period: PayrollPeriod): Promise<void>;
    deleteById(id: string): Promise<void>;
}
