import Department from "@modules/department/core/domain/entities/Department";

export default interface DepartmentRepo {
    getById(id: string): Promise<Department | undefined>;
    getByCode(code: string): Promise<Department | undefined>;
    listAll(): Promise<Department[]>;
    listChildren(parentDepartmentId: string): Promise<Department[]>;
    countChildren(parentDepartmentId: string): Promise<number>;
    save(department: Department): Promise<void>;
    deleteById(id: string): Promise<void>;
}
