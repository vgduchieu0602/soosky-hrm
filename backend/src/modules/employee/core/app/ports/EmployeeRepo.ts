import Employee from "@modules/employee/core/domain/entities/Employee";

export interface EmployeeListFilter {
    departmentId?: string | undefined;
    status?: string | undefined;
}

export default interface EmployeeRepo {
    getById(id: string): Promise<Employee | undefined>;
    getByCode(code: string): Promise<Employee | undefined>;
    list(filter: EmployeeListFilter): Promise<Employee[]>;
    save(employee: Employee): Promise<void>;
    deleteById(id: string): Promise<void>;
}
