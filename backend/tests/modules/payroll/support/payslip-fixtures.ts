import { PayslipInputs } from "@modules/payroll/core/domain/entities/Payslip";
import { PAYROLL_ENGINE_VERSION } from "@modules/payroll/core/domain/services/salary-calc";

/**
 * Bản chụp đầu vào tối thiểu cho phiếu lương trong test.
 *
 * Nội dung bản chụp không phải đối tượng kiểm thử của các test dựng phiếu sẵn —
 * chúng chỉ cần một phiếu hợp lệ. Test nào thực sự kiểm truy vết thì tự dựng
 * `inputs` riêng và assert vào đó.
 */
export function testPayslipInputs(overrides: Partial<PayslipInputs> = {}): PayslipInputs {
    return {
        engineVersion:  PAYROLL_ENGINE_VERSION,
        salaryPolicyId: "policy-1",
        taxProfileId:   null,
        allowanceIds:   [],
        bonusIds:       [],
        deductionIds:   [],
        contractIds:    ["contract-1"],
        retroIds:       [],
        computedBy:     "hr-1",
        recomputeCount: 0,
        ...overrides,
    };
}
