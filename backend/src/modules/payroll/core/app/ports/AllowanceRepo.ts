import Allowance from "@modules/payroll/core/domain/entities/Allowance";

export default interface AllowanceRepo {
    getById(id: string): Promise<Allowance | undefined>;
    listByEmployeeId(employeeId: string): Promise<Allowance[]>;
    save(allowance: Allowance): Promise<void>;
    deleteById(id: string): Promise<void>;
}
