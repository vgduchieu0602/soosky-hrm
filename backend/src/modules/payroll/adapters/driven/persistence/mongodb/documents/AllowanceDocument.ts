import { AllowanceType } from "@modules/payroll/core/domain/entities/Allowance";

export default interface AllowanceDocument {
    _id:             string;
    employeeId:      string;
    name:            string;
    type:            AllowanceType;
    amount:          number;
    isTaxable:       boolean;
    isInsuranceBase: boolean;
    effectiveDate:   Date;
    endDate:         Date | null;
    createdAt:       Date;
}
