import { InsuranceRates, SalaryComponentWeights, TaxBracket } from "@modules/payroll/core/domain/services/salary-calc";

export default interface SalaryPolicyDocument {
    _id:                         string;
    effectiveFrom:               Date;
    baseSalaryReference:         number;
    regionalMinWage:             number;
    insuranceCeilingMultiplier:  number;
    socialInsuranceSalary:       number;
    personalDeduction:           number;
    dependentDeduction:          number;
    taxBrackets:                 TaxBracket[];
    insuranceRates:              InsuranceRates;
    unionFeeRate:                number;
    unionFeeEnabled:             boolean;
    taxEnabled:                  boolean;
    nonResidentTaxRate:          number;
    probationPayRate:            number;
    salaryComponentWeights:      SalaryComponentWeights;
    prorateByAttendance:         boolean;
    createdAt:                   Date;
}
