import CompensationCatalogInvalidError from "@modules/payroll/core/domain/errors/CompensationCatalogInvalidError";
import { InsuranceRates, SalaryComponentWeights, TaxBracket, VN_INSURANCE_RATES, VN_PIT_BRACKETS } from "@modules/payroll/core/domain/services/salary-calc";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface SalaryPolicyProps {
    id:                          string;
    effectiveFrom:               Date;
    /** Lương cơ sở — dùng tính trần BHXH/BHYT (× insuranceCeilingMultiplier). */
    baseSalaryReference:         number;
    /** Lương tối thiểu vùng — dùng tính trần BHTN. Giản lược: một giá trị cho
     *  toàn công ty (bản cũ có bảng theo zone — xem payroll-report.md). */
    regionalMinWage:             number;
    insuranceCeilingMultiplier:  number;
    /** Mức lương cố định công ty đăng ký đóng BHXH (mức đóng BHXH). */
    socialInsuranceSalary:       number;
    personalDeduction:           number;
    dependentDeduction:          number;
    taxBrackets:                 TaxBracket[];
    insuranceRates:              InsuranceRates;
    unionFeeRate:                number;
    unionFeeEnabled:             boolean;
    /** Bật thuế TNCN. Mặc định tắt (chính sách giản lược hiện tại của công ty). */
    taxEnabled:                  boolean;
    nonResidentTaxRate:          number;
    /** % lương thử việc so với lương hợp đồng (mặc định 85). */
    probationPayRate:            number;
    salaryComponentWeights:      SalaryComponentWeights;
    prorateByAttendance:         boolean;
    createdAt:                   Date;
}

/** Chính sách lương công ty hiệu lực theo `effectiveFrom` — gộp tham số tính BH/thuế/20-60-20. */
export default class SalaryPolicy extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        private _effectiveFrom: Date,
        private _baseSalaryReference: number,
        private _regionalMinWage: number,
        private _insuranceCeilingMultiplier: number,
        private _socialInsuranceSalary: number,
        private _personalDeduction: number,
        private _dependentDeduction: number,
        private _taxBrackets: TaxBracket[],
        private _insuranceRates: InsuranceRates,
        private _unionFeeRate: number,
        private _unionFeeEnabled: boolean,
        private _taxEnabled: boolean,
        private _nonResidentTaxRate: number,
        private _probationPayRate: number,
        private _salaryComponentWeights: SalaryComponentWeights,
        private _prorateByAttendance: boolean,
    ) {
        super();
    }

    get effectiveFrom(): Date { return this._effectiveFrom; }
    get baseSalaryReference(): number { return this._baseSalaryReference; }
    get regionalMinWage(): number { return this._regionalMinWage; }
    get insuranceCeilingMultiplier(): number { return this._insuranceCeilingMultiplier; }
    get socialInsuranceSalary(): number { return this._socialInsuranceSalary; }
    get personalDeduction(): number { return this._personalDeduction; }
    get dependentDeduction(): number { return this._dependentDeduction; }
    get taxBrackets(): TaxBracket[] { return this._taxBrackets; }
    get insuranceRates(): InsuranceRates { return this._insuranceRates; }
    get unionFeeRate(): number { return this._unionFeeRate; }
    get unionFeeEnabled(): boolean { return this._unionFeeEnabled; }
    get taxEnabled(): boolean { return this._taxEnabled; }
    get nonResidentTaxRate(): number { return this._nonResidentTaxRate; }
    get probationPayRate(): number { return this._probationPayRate; }
    get salaryComponentWeights(): SalaryComponentWeights { return this._salaryComponentWeights; }
    get prorateByAttendance(): boolean { return this._prorateByAttendance; }

    get socialHealthCeiling(): number { return this._baseSalaryReference * this._insuranceCeilingMultiplier; }
    get unemploymentCeiling(): number { return this._regionalMinWage * this._insuranceCeilingMultiplier; }

    static create(input: Partial<Omit<SalaryPolicyProps, "id" | "createdAt">> & { id: string; effectiveFrom: Date; baseSalaryReference: number; regionalMinWage: number; socialInsuranceSalary: number }): SalaryPolicy {
        return SalaryPolicy.rehydrate({
            id: input.id,
            createdAt: new Date(),
            effectiveFrom: input.effectiveFrom,
            baseSalaryReference: input.baseSalaryReference,
            regionalMinWage: input.regionalMinWage,
            insuranceCeilingMultiplier: input.insuranceCeilingMultiplier ?? 20,
            socialInsuranceSalary: input.socialInsuranceSalary,
            personalDeduction: input.personalDeduction ?? 11_000_000,
            dependentDeduction: input.dependentDeduction ?? 4_400_000,
            taxBrackets: input.taxBrackets ?? VN_PIT_BRACKETS,
            insuranceRates: input.insuranceRates ?? VN_INSURANCE_RATES,
            unionFeeRate: input.unionFeeRate ?? 1,
            unionFeeEnabled: input.unionFeeEnabled ?? true,
            taxEnabled: input.taxEnabled ?? false,
            nonResidentTaxRate: input.nonResidentTaxRate ?? 20,
            probationPayRate: input.probationPayRate ?? 85,
            salaryComponentWeights: input.salaryComponentWeights ?? { attendance: 20, performance: 60, goal: 20 },
            prorateByAttendance: input.prorateByAttendance ?? true,
        });
    }

    static rehydrate(props: SalaryPolicyProps): SalaryPolicy {
        if (props.baseSalaryReference < 0 || props.regionalMinWage < 0 || props.socialInsuranceSalary < 0) {
            throw new CompensationCatalogInvalidError("Salary policy reference amounts must not be negative");
        }
        const w = props.salaryComponentWeights;
        if (w.attendance + w.performance + w.goal !== 100) {
            throw new CompensationCatalogInvalidError("Salary component weights must sum to 100");
        }
        return new SalaryPolicy(
            props.id, props.createdAt, props.effectiveFrom, props.baseSalaryReference, props.regionalMinWage,
            props.insuranceCeilingMultiplier, props.socialInsuranceSalary, props.personalDeduction,
            props.dependentDeduction, props.taxBrackets, props.insuranceRates, props.unionFeeRate,
            props.unionFeeEnabled, props.taxEnabled, props.nonResidentTaxRate, props.probationPayRate,
            props.salaryComponentWeights, props.prorateByAttendance,
        );
    }
}
