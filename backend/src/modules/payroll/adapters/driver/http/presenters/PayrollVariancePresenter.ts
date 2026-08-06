import PayrollVariance from "@modules/payroll/core/domain/entities/PayrollVariance";

export interface PayrollVarianceDTO {
    payrollPeriodId: string;
    employeeId:      string;
    baselineEngine:  string;
    targetEngine:    string;
    baselineNet:     number;
    targetNet:       number;
    /** Dương = engine mới trả cao hơn engine cũ. */
    diff:            number;
    fields:          { field: string; baseline: number; target: number }[];
    detectedAt:      string;
    detectedBy:      string;
    signedBy:        string | null;
    signedAt:        string | null;
    explanation:     string | null;
}

const PayrollVariancePresenter = {
    toDTO(variance: PayrollVariance): PayrollVarianceDTO {
        return {
            payrollPeriodId: variance.payrollPeriodId,
            employeeId:      variance.employeeId,
            baselineEngine:  variance.baselineEngine,
            targetEngine:    variance.targetEngine,
            baselineNet:     variance.baselineNet,
            targetNet:       variance.targetNet,
            diff:            variance.diff,
            fields:          variance.fields.map(field => ({ ...field })),
            detectedAt:      variance.detectedAt.toISOString(),
            detectedBy:      variance.detectedBy,
            signedBy:        variance.signedBy,
            signedAt:        variance.signedAt?.toISOString() ?? null,
            explanation:     variance.explanation,
        };
    },
};

export default PayrollVariancePresenter;
