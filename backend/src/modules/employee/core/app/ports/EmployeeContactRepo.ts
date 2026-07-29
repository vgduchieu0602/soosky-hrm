import EmployeeContact from "@modules/employee/core/domain/entities/EmployeeContact";

export default interface EmployeeContactRepo {
    getById(id: string): Promise<EmployeeContact | undefined>;
    listByEmployeeId(employeeId: string): Promise<EmployeeContact[]>;
    save(contact: EmployeeContact): Promise<void>;
    deleteById(id: string): Promise<void>;
}
