import ApplicationError from "@shared/core/app/errors/ApplicationError";

/**
 * Phòng ban tham chiếu (`departmentId`) không tồn tại — kiểm tra qua cổng
 * {@link "@modules/employee/core/app/ports/OrgDirectory"} để tránh phụ thuộc
 * trực tiếp vào module Department.
 */
export default class EmployeeDepartmentNotFoundError extends ApplicationError {
    readonly code       = "DEPARTMENT_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Department not found");
    }
}
