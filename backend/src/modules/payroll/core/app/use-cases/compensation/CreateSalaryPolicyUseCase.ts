import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import SalaryPolicyRepo from "@modules/payroll/core/app/ports/SalaryPolicyRepo";
import { InsuranceRates, SalaryComponentWeights, TaxBracket } from "@modules/payroll/core/domain/services/salary-calc";
import SalaryPolicy from "@modules/payroll/core/domain/entities/SalaryPolicy";
import { v7 as UUIDv7 } from "uuid";

const PERMISSION_KEY = "payroll:manage";

export interface CreateSalaryPolicyInput {
    effectiveFrom:               Date;
    baseSalaryReference:         number;
    regionalMinWage:             number;
    socialInsuranceSalary:       number;
    insuranceCeilingMultiplier?: number;
    personalDeduction?:         number;
    dependentDeduction?:        number;
    taxBrackets?:               TaxBracket[];
    insuranceRates?:            InsuranceRates;
    unionFeeRate?:               number;
    unionFeeEnabled?:            boolean;
    taxEnabled?:                 boolean;
    nonResidentTaxRate?:         number;
    probationPayRate?:           number;
    salaryComponentWeights?:     SalaryComponentWeights;
    prorateByAttendance?:        boolean;
    actorUserId:                 string;
}

/**
 * Tạo chính sách lương mới, hiệu lực từ `effectiveFrom` — gộp tham số BH/thuế/
 * 20-60-20 mà `RunPayrollForEmployeeUseCase` cần. Giản lược so với bản cũ:
 * module Settings chưa tồn tại nên CRUD chính sách lương nằm ngay trong
 * module Payroll (chỉ tạo + tra cứu, chưa có sửa/xoá — xem payroll-report.md).
 */
export default class CreateSalaryPolicyUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _policies: SalaryPolicyRepo,
    ) {}

    public async execute(input: CreateSalaryPolicyInput): Promise<SalaryPolicy> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const policy = SalaryPolicy.create({
            id: UUIDv7(),
            effectiveFrom: input.effectiveFrom,
            baseSalaryReference: input.baseSalaryReference,
            regionalMinWage: input.regionalMinWage,
            socialInsuranceSalary: input.socialInsuranceSalary,
            ...(input.insuranceCeilingMultiplier != undefined ? { insuranceCeilingMultiplier: input.insuranceCeilingMultiplier } : {}),
            ...(input.personalDeduction != undefined ? { personalDeduction: input.personalDeduction } : {}),
            ...(input.dependentDeduction != undefined ? { dependentDeduction: input.dependentDeduction } : {}),
            ...(input.taxBrackets != undefined ? { taxBrackets: input.taxBrackets } : {}),
            ...(input.insuranceRates != undefined ? { insuranceRates: input.insuranceRates } : {}),
            ...(input.unionFeeRate != undefined ? { unionFeeRate: input.unionFeeRate } : {}),
            ...(input.unionFeeEnabled != undefined ? { unionFeeEnabled: input.unionFeeEnabled } : {}),
            ...(input.taxEnabled != undefined ? { taxEnabled: input.taxEnabled } : {}),
            ...(input.nonResidentTaxRate != undefined ? { nonResidentTaxRate: input.nonResidentTaxRate } : {}),
            ...(input.probationPayRate != undefined ? { probationPayRate: input.probationPayRate } : {}),
            ...(input.salaryComponentWeights != undefined ? { salaryComponentWeights: input.salaryComponentWeights } : {}),
            ...(input.prorateByAttendance != undefined ? { prorateByAttendance: input.prorateByAttendance } : {}),
        });

        await this._policies.save(policy);
        return policy;
    }
}
