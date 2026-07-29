import SalaryPolicy from "@modules/payroll/core/domain/entities/SalaryPolicy";

export default interface SalaryPolicyRepo {
    listAll(): Promise<SalaryPolicy[]>;
    /** Chính sách hiệu lực gần nhất tính tới một ngày (`effectiveFrom` ≤ date), hoặc `undefined`. */
    findEffectiveAt(date: Date): Promise<SalaryPolicy | undefined>;
    save(policy: SalaryPolicy): Promise<void>;
}
