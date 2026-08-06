import AttendanceCorrectionRequest from "@modules/attendance/core/domain/entities/AttendanceCorrectionRequest";

export interface AttendanceCorrectionDTO {
    id:                string;
    employeeId:        string;
    date:              string;
    requestedCheckIn:  string | null;
    requestedCheckOut: string | null;
    reason:            string;
    status:            string;
    createdBy:         string;
    createdAt:         string;
    decidedBy:         string | null;
    decidedAt:         string | null;
    decisionNote:      string | null;
}

const AttendanceCorrectionPresenter = {
    toDTO(request: AttendanceCorrectionRequest): AttendanceCorrectionDTO {
        return {
            id:                request.id,
            employeeId:        request.employeeId,
            date:              request.date.toISOString(),
            requestedCheckIn:  request.requestedCheckIn?.toISOString() ?? null,
            requestedCheckOut: request.requestedCheckOut?.toISOString() ?? null,
            reason:            request.reason,
            status:            request.status,
            createdBy:         request.createdBy,
            createdAt:         request.createdAt.toISOString(),
            decidedBy:         request.decidedBy,
            decidedAt:         request.decidedAt?.toISOString() ?? null,
            decisionNote:      request.decisionNote,
        };
    },
};

export default AttendanceCorrectionPresenter;
