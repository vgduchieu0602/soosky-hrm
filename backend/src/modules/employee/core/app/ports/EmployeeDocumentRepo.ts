import EmployeeDocument from "@modules/employee/core/domain/entities/EmployeeDocument";

export default interface EmployeeDocumentRepo {
    getById(id: string): Promise<EmployeeDocument | undefined>;
    listByEmployeeId(employeeId: string): Promise<EmployeeDocument[]>;
    save(document: EmployeeDocument): Promise<void>;
    deleteById(id: string): Promise<void>;
}
