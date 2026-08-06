import RetroAdjustment from "@modules/payroll/core/domain/entities/RetroAdjustment";

export interface RetroAdjustmentDTO {
    id:             string;
    employeeId:     string;
    kind:           string;
    amount:         number;
    taxable:        boolean;
    originPeriodId: string;
    payoutPeriodId: string;
    reason:         string;
    status:         string;
    createdBy:      string;
    createdAt:      string;
    cancelledBy:    string | null;
    cancelledAt:    string | null;
    cancelReason:   string | null;
}

const RetroAdjustmentPresenter = {
    toDTO(adjustment: RetroAdjustment): RetroAdjustmentDTO {
        return {
            id:             adjustment.id,
            employeeId:     adjustment.employeeId,
            kind:           adjustment.kind,
            amount:         adjustment.amount,
            taxable:        adjustment.taxable,
            originPeriodId: adjustment.originPeriodId,
            payoutPeriodId: adjustment.payoutPeriodId,
            reason:         adjustment.reason,
            status:         adjustment.status,
            createdBy:      adjustment.createdBy,
            createdAt:      adjustment.createdAt.toISOString(),
            cancelledBy:    adjustment.cancelledBy,
            cancelledAt:    adjustment.cancelledAt?.toISOString() ?? null,
            cancelReason:   adjustment.cancelReason,
        };
    },
};

export default RetroAdjustmentPresenter;
