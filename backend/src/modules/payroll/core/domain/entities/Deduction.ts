import CompensationCatalogInvalidError from "@modules/payroll/core/domain/errors/CompensationCatalogInvalidError";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export const DEDUCTION_TYPES = ["fixed", "percentage"] as const;
export type DeductionType = (typeof DEDUCTION_TYPES)[number];

export interface DeductionProps {
    id:              string;
    employeeId:      string;
    /** null = khấu trừ lặp lại mỗi kỳ trong thời gian hiệu lực; set = một lần cho kỳ đó. */
    payrollPeriodId: string | null;
    name:            string;
    type:            DeductionType;
    /** VNĐ khi 'fixed'; % của Gross khi 'percentage'. */
    amount:          number;
    reason:          string | null;
    effectiveDate:   Date;
    endDate:         Date | null;
    createdAt:       Date;
}

/** Khấu trừ sau thuế (tạm ứng, phạt, …) — trừ vào net sau khi tính thuế. */
export default class Deduction extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        public readonly employeeId: string,
        private _payrollPeriodId: string | null,
        private _name: string,
        private _type: DeductionType,
        private _amount: number,
        private _reason: string | null,
        private _effectiveDate: Date,
        private _endDate: Date | null,
    ) {
        super();
    }

    get payrollPeriodId(): string | null { return this._payrollPeriodId; }
    get name(): string { return this._name; }
    get type(): DeductionType { return this._type; }
    get amount(): number { return this._amount; }
    get reason(): string | null { return this._reason; }
    get effectiveDate(): Date { return this._effectiveDate; }
    get endDate(): Date | null { return this._endDate; }

    /** Có áp dụng cho kỳ lương này không: một lần đúng kỳ, hoặc lặp lại trong khoảng hiệu lực. */
    appliesToPeriod(periodId: string, periodStart: Date, periodEnd: Date): boolean {
        if (this._payrollPeriodId != null) return this._payrollPeriodId === periodId;
        return this._effectiveDate <= periodEnd && (this._endDate == null || this._endDate >= periodStart);
    }

    static create(input: Omit<DeductionProps, "createdAt">): Deduction {
        return Deduction.rehydrate({ ...input, createdAt: new Date() });
    }

    static rehydrate(props: DeductionProps): Deduction {
        if (props.name.trim().length === 0) {
            throw new CompensationCatalogInvalidError("Deduction name must not be empty");
        }
        if (props.amount < 0) {
            throw new CompensationCatalogInvalidError("Deduction amount must not be negative");
        }
        return new Deduction(
            props.id, props.createdAt, props.employeeId, props.payrollPeriodId, props.name.trim(),
            props.type, props.amount, props.reason, props.effectiveDate, props.endDate,
        );
    }

    update(patch: {
        payrollPeriodId?: string | null; name?: string; type?: DeductionType; amount?: number;
        reason?: string | null; effectiveDate?: Date; endDate?: Date | null;
    }): void {
        if (patch.payrollPeriodId !== undefined) this._payrollPeriodId = patch.payrollPeriodId;
        if (patch.name != undefined) {
            if (patch.name.trim().length === 0) throw new CompensationCatalogInvalidError("Deduction name must not be empty");
            this._name = patch.name.trim();
        }
        if (patch.type != undefined) this._type = patch.type;
        if (patch.amount != undefined) {
            if (patch.amount < 0) throw new CompensationCatalogInvalidError("Deduction amount must not be negative");
            this._amount = patch.amount;
        }
        if (patch.reason !== undefined) this._reason = patch.reason;
        if (patch.effectiveDate != undefined) this._effectiveDate = patch.effectiveDate;
        if (patch.endDate !== undefined) this._endDate = patch.endDate;
    }
}
