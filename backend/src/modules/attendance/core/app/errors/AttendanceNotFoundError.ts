import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class AttendanceNotFoundError extends ApplicationError {
    readonly code       = "ATTENDANCE_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Attendance record not found");
    }
}
