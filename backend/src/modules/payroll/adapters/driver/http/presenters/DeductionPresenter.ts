import Deduction from "@modules/payroll/core/domain/entities/Deduction";

export interface DeductionDTO {
    id:              string;
    employeeId:      string;
    payrollPeriodId: string | null;
    name:            string;
    type:            string;
    amount:          number;
    reason:          string | null;
    effectiveDate:   string;
    endDate:         string | null;
    createdAt:       string;
}

const DeductionPresenter = {
    toDTO(deduction: Deduction): DeductionDTO {
        return {
            id:              deduction.id,
            employeeId:      deduction.employeeId,
            payrollPeriodId: deduction.payrollPeriodId,
            name:            deduction.name,
            type:            deduction.type,
            amount:          deduction.amount,
            reason:          deduction.reason,
            effectiveDate:   deduction.effectiveDate.toISOString(),
            endDate:         deduction.endDate?.toISOString() ?? null,
            createdAt:       deduction.createdAt.toISOString(),
        };
    },
};

export default DeductionPresenter;
