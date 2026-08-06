import Employee from "@modules/employee/core/domain/entities/Employee";

export interface EmployeeListFilter {
    departmentId?: string | undefined;
    status?: string | undefined;
    /**
     * Thu hẹp về đúng tập id này — dùng bởi phân quyền theo phạm vi
     * (`team`/`self`). Mảng rỗng → không trả bản ghi nào.
     */
    ids?: readonly string[] | undefined;
}

export default interface EmployeeRepo {
    getById(id: string): Promise<Employee | undefined>;
    getByCode(code: string): Promise<Employee | undefined>;
    /** Nhân viên gắn với một tài khoản đăng nhập — dùng để biết actor là ai. */
    getByAccountId(accountId: string): Promise<Employee | undefined>;
    list(filter: EmployeeListFilter): Promise<Employee[]>;
    /** Id cấp dưới TRỰC TIẾP của một nhân viên (một tầng). */
    listDirectReportIds(managerId: string): Promise<string[]>;
    save(employee: Employee): Promise<void>;
    deleteById(id: string): Promise<void>;
}
