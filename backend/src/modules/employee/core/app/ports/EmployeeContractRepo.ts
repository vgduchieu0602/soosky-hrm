import EmployeeContract from "@modules/employee/core/domain/entities/EmployeeContract";

export default interface EmployeeContractRepo {
    getById(id: string): Promise<EmployeeContract | undefined>;
    listByEmployeeId(employeeId: string): Promise<EmployeeContract[]>;
    save(contract: EmployeeContract): Promise<void>;
    deleteById(id: string): Promise<void>;
}
