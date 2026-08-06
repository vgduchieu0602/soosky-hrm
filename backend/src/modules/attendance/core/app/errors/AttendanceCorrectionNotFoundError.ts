import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class AttendanceCorrectionNotFoundError extends ApplicationError {
    readonly code       = "ATTENDANCE_CORRECTION_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Attendance correction request not found");
    }
}
