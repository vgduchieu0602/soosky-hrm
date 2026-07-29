import { DeductionType } from "@modules/payroll/core/domain/entities/Deduction";

export default interface DeductionDocument {
    _id:             string;
    employeeId:      string;
    payrollPeriodId: string | null;
    name:            string;
    type:            DeductionType;
    amount:          number;
    reason:          string | null;
    effectiveDate:   Date;
    endDate:         Date | null;
    createdAt:       Date;
}
