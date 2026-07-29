import TaxProfile from "@modules/payroll/core/domain/entities/TaxProfile";

export default interface TaxProfileRepo {
    listByEmployeeId(employeeId: string): Promise<TaxProfile[]>;
    /** Hồ sơ thuế hiệu lực tại một ngày (mới nhất theo `effectiveDate`), hoặc `undefined`. */
    findEffectiveAt(employeeId: string, date: Date): Promise<TaxProfile | undefined>;
    save(taxProfile: TaxProfile): Promise<void>;
}
