import RetroAdjustmentRepo, { RetroListFilter } from "@modules/payroll/core/app/ports/RetroAdjustmentRepo";
import RetroAdjustment from "@modules/payroll/core/domain/entities/RetroAdjustment";

/** Repo hồi tố trong bộ nhớ — dùng chung cho các test dựng `RunPayrollForEmployeeUseCase`. */
export default class InMemoryRetroAdjustmentRepo implements RetroAdjustmentRepo {
    private readonly _store = new Map<string, RetroAdjustment>();

    async getById(id: string): Promise<RetroAdjustment | undefined> {
        return this._store.get(id);
    }

    async list(filter: RetroListFilter): Promise<RetroAdjustment[]> {
        return [...this._store.values()].filter(row =>
            (filter.employeeId == undefined     || row.employeeId === filter.employeeId)
            && (filter.payoutPeriodId == undefined || row.payoutPeriodId === filter.payoutPeriodId)
            && (filter.originPeriodId == undefined || row.originPeriodId === filter.originPeriodId));
    }

    async listActiveForPayout(employeeId: string, payoutPeriodId: string): Promise<RetroAdjustment[]> {
        return [...this._store.values()].filter(row =>
            row.employeeId === employeeId && row.payoutPeriodId === payoutPeriodId && row.isActive);
    }

    async save(adjustment: RetroAdjustment): Promise<void> {
        this._store.set(adjustment.id, adjustment);
    }
}
