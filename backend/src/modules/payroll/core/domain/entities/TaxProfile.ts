import CompensationCatalogInvalidError from "@modules/payroll/core/domain/errors/CompensationCatalogInvalidError";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface TaxProfileProps {
    id:               string;
    employeeId:       string;
    /** Cư trú → luỹ tiến + giảm trừ; không cư trú → thuế phẳng, không giảm trừ. */
    isResident:       boolean;
    dependentsCount:  number;
    /** Số tiền BHXH cố định HR nhập tay — ghi đè cách tính theo %. 0 = dùng cách tính theo %. */
    insuranceAmount:  number;
    effectiveDate:    Date;
    endDate:          Date | null;
    createdAt:        Date;
}

/**
 * Hồ sơ thuế của nhân viên — versioned theo `effectiveDate` (đổi số người phụ
 * thuộc/tình trạng cư trú giữa năm vẫn có lịch sử). Payroll snapshot bản hiệu
 * lực tại ngày trả lương của kỳ.
 */
export default class TaxProfile extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        public readonly employeeId: string,
        private _isResident: boolean,
        private _dependentsCount: number,
        private _insuranceAmount: number,
        private _effectiveDate: Date,
        private _endDate: Date | null,
    ) {
        super();
    }

    get isResident(): boolean { return this._isResident; }
    get dependentsCount(): number { return this._dependentsCount; }
    get insuranceAmount(): number { return this._insuranceAmount; }
    get effectiveDate(): Date { return this._effectiveDate; }
    get endDate(): Date | null { return this._endDate; }

    isActiveAt(date: Date): boolean {
        return this._effectiveDate <= date && (this._endDate == null || this._endDate >= date);
    }

    static create(input: Omit<TaxProfileProps, "createdAt">): TaxProfile {
        return TaxProfile.rehydrate({ ...input, createdAt: new Date() });
    }

    static rehydrate(props: TaxProfileProps): TaxProfile {
        if (props.dependentsCount < 0) {
            throw new CompensationCatalogInvalidError("Dependents count must not be negative");
        }
        if (props.insuranceAmount < 0) {
            throw new CompensationCatalogInvalidError("Insurance amount must not be negative");
        }
        return new TaxProfile(
            props.id, props.createdAt, props.employeeId, props.isResident,
            props.dependentsCount, props.insuranceAmount, props.effectiveDate, props.endDate,
        );
    }
}
