import RetroAdjustmentRepo, { RetroListFilter } from "@modules/payroll/core/app/ports/RetroAdjustmentRepo";
import RetroAdjustment from "@modules/payroll/core/domain/entities/RetroAdjustment";

export type ListRetroAdjustmentsInput = RetroListFilter;

/** Liệt kê điều chỉnh hồi tố (kể cả đã huỷ — dấu vết phải đọc được). */
export default class ListRetroAdjustmentsUseCase {
    public constructor(
        private readonly _retros: RetroAdjustmentRepo,
    ) {}

    public async execute(input: ListRetroAdjustmentsInput): Promise<RetroAdjustment[]> {
        return this._retros.list(input);
    }
}
