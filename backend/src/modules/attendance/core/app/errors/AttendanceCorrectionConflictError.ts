import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class AttendanceCorrectionConflictError extends ApplicationError {
    readonly code       = "ATTENDANCE_CORRECTION_CONFLICT";
    readonly httpStatus = 409;

    constructor(pendingRequestId: string) {
        super(`A pending correction request (${pendingRequestId}) already exists for this day`);
    }
}
