import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class AttendancePeriodLockedError extends ApplicationError {
    readonly code       = "ATTENDANCE_PERIOD_LOCKED";
    readonly httpStatus = 409;

    constructor(periodName: string) {
        super(`Attendance for period ${periodName} is locked; unlock it before changing any record`);
    }
}
