import SalaryPolicy from "@modules/payroll/core/domain/entities/SalaryPolicy";

export interface SalaryPolicyDTO {
    id:                         string;
    effectiveFrom:              string;
    baseSalaryReference:        number;
    regionalMinWage:            number;
    insuranceCeilingMultiplier: number;
    socialInsuranceSalary:      number;
    personalDeduction:          number;
    dependentDeduction:         number;
    unionFeeRate:               number;
    unionFeeEnabled:            boolean;
    taxEnabled:                 boolean;
    nonResidentTaxRate:         number;
    probationPayRate:           number;
    prorateByAttendance:        boolean;
    createdAt:                  string;
}

const SalaryPolicyPresenter = {
    toDTO(policy: SalaryPolicy): SalaryPolicyDTO {
        return {
            id:                         policy.id,
            effectiveFrom:              policy.effectiveFrom.toISOString(),
            baseSalaryReference:        policy.baseSalaryReference,
            regionalMinWage:            policy.regionalMinWage,
            insuranceCeilingMultiplier: policy.insuranceCeilingMultiplier,
            socialInsuranceSalary:      policy.socialInsuranceSalary,
            personalDeduction:          policy.personalDeduction,
            dependentDeduction:         policy.dependentDeduction,
            unionFeeRate:               policy.unionFeeRate,
            unionFeeEnabled:            policy.unionFeeEnabled,
            taxEnabled:                 policy.taxEnabled,
            nonResidentTaxRate:         policy.nonResidentTaxRate,
            probationPayRate:           policy.probationPayRate,
            prorateByAttendance:        policy.prorateByAttendance,
            createdAt:                  policy.createdAt.toISOString(),
        };
    },
};

export default SalaryPolicyPresenter;
