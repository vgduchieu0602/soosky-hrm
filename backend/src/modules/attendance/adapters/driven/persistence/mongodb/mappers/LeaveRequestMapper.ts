import LeaveRequestDocument from "@modules/attendance/adapters/driven/persistence/mongodb/documents/LeaveRequestDocument";
import LeaveRequest from "@modules/attendance/core/domain/entities/LeaveRequest";
import LeaveStatus from "@modules/attendance/core/domain/value-objects/LeaveStatus";
import LeaveType from "@modules/attendance/core/domain/value-objects/LeaveType";

const LeaveRequestMapper = {
    toDocument(leaveRequest: LeaveRequest): LeaveRequestDocument {
        return {
            _id:             leaveRequest.id,
            employeeId:      leaveRequest.employeeId,
            leaveType:       leaveRequest.leaveType.value,
            startDate:       leaveRequest.startDate,
            endDate:         leaveRequest.endDate,
            days:            leaveRequest.days,
            halfDaySession:  leaveRequest.halfDaySession,
            reason:          leaveRequest.reason,
            status:          leaveRequest.status.value,
            approverId:      leaveRequest.approverId,
            approvedAt:      leaveRequest.approvedAt,
            rejectionReason: leaveRequest.rejectionReason,
            createdBy:       leaveRequest.createdBy,
            createdAt:       leaveRequest.createdAt,
        };
    },

    toDomain(document: LeaveRequestDocument): LeaveRequest {
        return LeaveRequest.rehydrate({
            id:              document._id,
            employeeId:      document.employeeId,
            leaveType:       LeaveType.create(document.leaveType),
            startDate:       document.startDate,
            endDate:         document.endDate,
            days:            document.days,
            halfDaySession:  document.halfDaySession,
            reason:          document.reason,
            status:          LeaveStatus.create(document.status),
            approverId:      document.approverId,
            approvedAt:      document.approvedAt,
            rejectionReason: document.rejectionReason,
            createdBy:       document.createdBy,
            createdAt:       document.createdAt,
        });
    },
};

export default LeaveRequestMapper;
