import EmployeeBankAccount from "@modules/employee/core/domain/entities/EmployeeBankAccount";

export default interface EmployeeBankAccountRepo {
    getById(id: string): Promise<EmployeeBankAccount | undefined>;
    listByEmployeeId(employeeId: string): Promise<EmployeeBankAccount[]>;
    save(account: EmployeeBankAccount): Promise<void>;
    deleteById(id: string): Promise<void>;
}
