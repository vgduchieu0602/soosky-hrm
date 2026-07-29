import LeaveBalanceDocument from "@modules/attendance/adapters/driven/persistence/mongodb/documents/LeaveBalanceDocument";
import LeaveBalance from "@modules/attendance/core/domain/entities/LeaveBalance";
import LeaveType from "@modules/attendance/core/domain/value-objects/LeaveType";

const LeaveBalanceMapper = {
    toDocument(leaveBalance: LeaveBalance): LeaveBalanceDocument {
        return {
            _id:        leaveBalance.id,
            employeeId: leaveBalance.employeeId,
            leaveType:  leaveBalance.leaveType.value,
            year:       leaveBalance.year,
            entitled:   leaveBalance.entitled,
            used:       leaveBalance.used,
            createdAt:  leaveBalance.createdAt,
        };
    },

    toDomain(document: LeaveBalanceDocument): LeaveBalance {
        return LeaveBalance.rehydrate({
            id:         document._id,
            employeeId: document.employeeId,
            leaveType:  LeaveType.create(document.leaveType),
            year:       document.year,
            entitled:   document.entitled,
            used:       document.used,
            createdAt:  document.createdAt,
        });
    },
};

export default LeaveBalanceMapper;
