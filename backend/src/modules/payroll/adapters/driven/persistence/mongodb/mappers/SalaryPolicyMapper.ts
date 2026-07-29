import SalaryPolicyDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/SalaryPolicyDocument";
import SalaryPolicy from "@modules/payroll/core/domain/entities/SalaryPolicy";

const SalaryPolicyMapper = {
    toDocument(policy: SalaryPolicy): SalaryPolicyDocument {
        return {
            _id:                        policy.id,
            effectiveFrom:              policy.effectiveFrom,
            baseSalaryReference:        policy.baseSalaryReference,
            regionalMinWage:            policy.regionalMinWage,
            insuranceCeilingMultiplier: policy.insuranceCeilingMultiplier,
            socialInsuranceSalary:      policy.socialInsuranceSalary,
            personalDeduction:          policy.personalDeduction,
            dependentDeduction:         policy.dependentDeduction,
            taxBrackets:                policy.taxBrackets,
            insuranceRates:             policy.insuranceRates,
            unionFeeRate:               policy.unionFeeRate,
            unionFeeEnabled:            policy.unionFeeEnabled,
            taxEnabled:                 policy.taxEnabled,
            nonResidentTaxRate:         policy.nonResidentTaxRate,
            probationPayRate:           policy.probationPayRate,
            salaryComponentWeights:     policy.salaryComponentWeights,
            prorateByAttendance:        policy.prorateByAttendance,
            createdAt:                  policy.createdAt,
        };
    },

    toDomain(document: SalaryPolicyDocument): SalaryPolicy {
        return SalaryPolicy.rehydrate({
            id:                         document._id,
            effectiveFrom:              document.effectiveFrom,
            baseSalaryReference:        document.baseSalaryReference,
            regionalMinWage:            document.regionalMinWage,
            insuranceCeilingMultiplier: document.insuranceCeilingMultiplier,
            socialInsuranceSalary:      document.socialInsuranceSalary,
            personalDeduction:          document.personalDeduction,
            dependentDeduction:         document.dependentDeduction,
            taxBrackets:                document.taxBrackets,
            insuranceRates:             document.insuranceRates,
            unionFeeRate:               document.unionFeeRate,
            unionFeeEnabled:            document.unionFeeEnabled,
            taxEnabled:                 document.taxEnabled,
            nonResidentTaxRate:         document.nonResidentTaxRate,
            probationPayRate:           document.probationPayRate,
            salaryComponentWeights:     document.salaryComponentWeights,
            prorateByAttendance:        document.prorateByAttendance,
            createdAt:                  document.createdAt,
        });
    },
};

export default SalaryPolicyMapper;
