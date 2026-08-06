import AttendanceCorrectionRequestDocument from "@modules/attendance/adapters/driven/persistence/mongodb/documents/AttendanceCorrectionRequestDocument";
import AttendanceCorrectionRequest, { CorrectionStatus } from "@modules/attendance/core/domain/entities/AttendanceCorrectionRequest";

const AttendanceCorrectionRequestMapper = {
    toDocument(request: AttendanceCorrectionRequest): AttendanceCorrectionRequestDocument {
        return {
            _id:               request.id,
            employeeId:        request.employeeId,
            date:              request.date,
            requestedCheckIn:  request.requestedCheckIn,
            requestedCheckOut: request.requestedCheckOut,
            reason:            request.reason,
            status:            request.status,
            createdBy:         request.createdBy,
            createdAt:         request.createdAt,
            decidedBy:         request.decidedBy,
            decidedAt:         request.decidedAt,
            decisionNote:      request.decisionNote,
        };
    },

    toDomain(document: AttendanceCorrectionRequestDocument): AttendanceCorrectionRequest {
        return AttendanceCorrectionRequest.rehydrate({
            id:                document._id,
            employeeId:        document.employeeId,
            date:              document.date,
            requestedCheckIn:  document.requestedCheckIn,
            requestedCheckOut: document.requestedCheckOut,
            reason:            document.reason,
            status:            document.status as CorrectionStatus,
            createdBy:         document.createdBy,
            createdAt:         document.createdAt,
            decidedBy:         document.decidedBy,
            decidedAt:         document.decidedAt,
            decisionNote:      document.decisionNote,
        });
    },
};

export default AttendanceCorrectionRequestMapper;
