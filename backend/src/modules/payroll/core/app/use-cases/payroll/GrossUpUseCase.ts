import SalaryPolicyNotFoundError from "@modules/payroll/core/app/errors/SalaryPolicyNotFoundError";
import SalaryPolicyRepo from "@modules/payroll/core/app/ports/SalaryPolicyRepo";
import { GrossUpResult, grossUpFromNet } from "@modules/payroll/core/domain/services/salary-calc";

export interface GrossUpInput {
    net:              number;
    payDate?:         Date;
    dependentsCount?: number;
    isResident?:      boolean;
}

/**
 * NET → GROSS: tìm lương gross sao cho thực nhận khớp `net` mong muốn, dùng
 * đúng công cụ tính bảo hiểm/thuế của chính sách hiệu lực tại `payDate`
 * (mặc định hôm nay) — nhất quán với engine tính lương thật.
 *
 * @throws {SalaryPolicyNotFoundError} Không có chính sách lương hiệu lực.
 */
export default class GrossUpUseCase {
    public constructor(
        private readonly _policies: SalaryPolicyRepo,
    ) {}

    public async execute(input: GrossUpInput): Promise<GrossUpResult> {
        const payDate = input.payDate ?? new Date();
        const policy = await this._policies.findEffectiveAt(payDate);
        if (policy == undefined) throw new SalaryPolicyNotFoundError();

        return grossUpFromNet(input.net, {
            socialHealthCeiling: policy.socialHealthCeiling,
            unemploymentCeiling: policy.unemploymentCeiling,
            personalDeduction: policy.personalDeduction,
            dependentDeduction: policy.dependentDeduction,
            dependentsCount: input.dependentsCount ?? 0,
            isResident: input.isResident ?? true,
            nonResidentTaxRate: policy.nonResidentTaxRate,
            taxEnabled: policy.taxEnabled,
            taxBrackets: policy.taxBrackets,
            insuranceRates: policy.insuranceRates,
            insuranceBaseSalary: policy.socialInsuranceSalary || undefined,
        });
    }
}
