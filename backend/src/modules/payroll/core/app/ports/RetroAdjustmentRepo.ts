import RetroAdjustment from "@modules/payroll/core/domain/entities/RetroAdjustment";

export interface RetroListFilter {
    employeeId?: string | undefined;
    payoutPeriodId?: string | undefined;
    originPeriodId?: string | undefined;
}

export default interface RetroAdjustmentRepo {
    getById(id: string): Promise<RetroAdjustment | undefined>;
    list(filter: RetroListFilter): Promise<RetroAdjustment[]>;
    /** Chỉ các khoản CÒN HIỆU LỰC của một nhân viên trong kỳ chi trả — dùng khi tính lương. */
    listActiveForPayout(employeeId: string, payoutPeriodId: string): Promise<RetroAdjustment[]>;
    save(adjustment: RetroAdjustment): Promise<void>;
}
