import ApplicationError from "@shared/core/app/errors/ApplicationError";

/**
 * Vị trí tham chiếu (`positionId`) không tồn tại — kiểm tra qua cổng
 * {@link "@modules/employee/core/app/ports/OrgDirectory"} để tránh phụ thuộc
 * trực tiếp vào module Department.
 */
export default class EmployeePositionNotFoundError extends ApplicationError {
    readonly code       = "POSITION_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Position not found");
    }
}
