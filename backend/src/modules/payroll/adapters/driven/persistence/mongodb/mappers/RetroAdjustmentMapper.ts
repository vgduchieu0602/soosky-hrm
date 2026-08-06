import RetroAdjustmentDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/RetroAdjustmentDocument";
import RetroAdjustment, { RetroKind, RetroStatus } from "@modules/payroll/core/domain/entities/RetroAdjustment";

const RetroAdjustmentMapper = {
    toDocument(adjustment: RetroAdjustment): RetroAdjustmentDocument {
        return {
            _id:            adjustment.id,
            employeeId:     adjustment.employeeId,
            kind:           adjustment.kind,
            amount:         adjustment.amount,
            taxable:        adjustment.taxable,
            originPeriodId: adjustment.originPeriodId,
            payoutPeriodId: adjustment.payoutPeriodId,
            reason:         adjustment.reason,
            status:         adjustment.status,
            createdBy:      adjustment.createdBy,
            createdAt:      adjustment.createdAt,
            cancelledBy:    adjustment.cancelledBy,
            cancelledAt:    adjustment.cancelledAt,
            cancelReason:   adjustment.cancelReason,
        };
    },

    toDomain(document: RetroAdjustmentDocument): RetroAdjustment {
        return RetroAdjustment.rehydrate({
            id:             document._id,
            employeeId:     document.employeeId,
            kind:           document.kind as RetroKind,
            amount:         document.amount,
            taxable:        document.taxable,
            originPeriodId: document.originPeriodId,
            payoutPeriodId: document.payoutPeriodId,
            reason:         document.reason,
            status:         document.status as RetroStatus,
            createdBy:      document.createdBy,
            createdAt:      document.createdAt,
            cancelledBy:    document.cancelledBy,
            cancelledAt:    document.cancelledAt,
            cancelReason:   document.cancelReason,
        });
    },
};

export default RetroAdjustmentMapper;
