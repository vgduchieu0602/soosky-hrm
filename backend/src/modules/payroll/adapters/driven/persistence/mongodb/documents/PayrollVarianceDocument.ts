import { VarianceField } from "@modules/payroll/core/domain/entities/PayrollVariance";

/** Dạng document lưu trữ của aggregate `PayrollVariance`. */
export default interface PayrollVarianceDocument {
    _id:             string;
    payrollPeriodId: string;
    employeeId:      string;
    baselineEngine:  string;
    targetEngine:    string;
    baselineNet:     number;
    targetNet:       number;
    fields:          VarianceField[];
    detectedAt:      Date;
    detectedBy:      string;
    signedBy:        string | null;
    signedAt:        Date | null;
    explanation:     string | null;
}
