import VarianceSignoffInvalidError from "@modules/payroll/core/domain/errors/VarianceSignoffInvalidError";
import { PayrollEngineVersion } from "@modules/payroll/core/domain/services/salary-calc";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

const EXPLANATION_MIN_LENGTH = 10;
const EXPLANATION_MAX_LENGTH = 1000;

/** Một con số khác nhau giữa hai phiên bản công thức. */
export interface VarianceField {
    field:    string;
    baseline: number;
    target:   number;
}

export interface PayrollVarianceProps {
    id:              string;
    payrollPeriodId: string;
    employeeId:      string;
    baselineEngine:  PayrollEngineVersion;
    targetEngine:    PayrollEngineVersion;
    baselineNet:     number;
    targetNet:       number;
    fields:          VarianceField[];
    detectedAt:      Date;
    detectedBy:      string;
    signedBy:        string | null;
    signedAt:        Date | null;
    explanation:     string | null;
}

export type PayrollVarianceDetectionInput = Omit<PayrollVarianceProps,
    "detectedAt" | "signedBy" | "signedAt" | "explanation">;

/**
 * Chênh lệch giữa hai phiên bản công thức cho MỘT nhân viên trong MỘT kỳ, kèm
 * chữ ký xác nhận.
 *
 * Vì sao phải lưu thành bản ghi thay vì tính lại mỗi lần xem: chữ ký gắn với
 * ĐÚNG con số đã được giải thích. Nếu đầu vào đổi và chênh lệch thành số khác,
 * chữ ký cũ mất hiệu lực — `redetect` tự xoá nó thay vì để một lời giải thích cũ
 * bảo lãnh cho một con số mới.
 */
export default class PayrollVariance extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly payrollPeriodId: string,
        public readonly employeeId: string,
        public readonly baselineEngine: PayrollEngineVersion,
        public readonly targetEngine: PayrollEngineVersion,
        private _baselineNet: number,
        private _targetNet: number,
        private _fields: VarianceField[],
        private _detectedAt: Date,
        private _detectedBy: string,
        private _signedBy: string | null,
        private _signedAt: Date | null,
        private _explanation: string | null,
    ) {
        super();
    }

    get baselineNet(): number { return this._baselineNet; }
    get targetNet(): number { return this._targetNet; }
    /** Dương = engine mới trả CAO hơn engine cũ. */
    get diff(): number { return this._targetNet - this._baselineNet; }
    get fields(): readonly VarianceField[] { return this._fields.map(field => ({ ...field })); }
    get detectedAt(): Date { return this._detectedAt; }
    get detectedBy(): string { return this._detectedBy; }
    get signedBy(): string | null { return this._signedBy; }
    get signedAt(): Date | null { return this._signedAt; }
    get explanation(): string | null { return this._explanation; }
    get isSigned(): boolean { return this._signedAt != null; }

    static detect(input: PayrollVarianceDetectionInput): PayrollVariance {
        return new PayrollVariance(
            input.id, input.payrollPeriodId, input.employeeId,
            input.baselineEngine, input.targetEngine,
            input.baselineNet, input.targetNet, input.fields,
            new Date(), input.detectedBy, null, null, null,
        );
    }

    static rehydrate(props: PayrollVarianceProps): PayrollVariance {
        return new PayrollVariance(
            props.id, props.payrollPeriodId, props.employeeId,
            props.baselineEngine, props.targetEngine,
            props.baselineNet, props.targetNet, props.fields,
            props.detectedAt, props.detectedBy,
            props.signedBy, props.signedAt, props.explanation,
        );
    }

    /**
     * Chạy lại đối soát: cập nhật số. Số ĐỔI thì chữ ký cũ bị xoá — lời giải
     * thích chỉ có giá trị cho con số nó giải thích.
     */
    redetect(input: { baselineNet: number; targetNet: number; fields: VarianceField[]; detectedBy: string }): void {
        const changed = input.baselineNet !== this._baselineNet || input.targetNet !== this._targetNet;

        this._baselineNet = input.baselineNet;
        this._targetNet   = input.targetNet;
        this._fields      = input.fields;
        this._detectedAt  = new Date();
        this._detectedBy  = input.detectedBy;

        if (changed) {
            this._signedBy    = null;
            this._signedAt    = null;
            this._explanation = null;
        }
    }

    /**
     * @throws {VarianceSignoffInvalidError} Đã ký trước đó, hoặc lời giải thích quá ngắn/quá dài.
     */
    sign(byUserId: string, explanation: string): void {
        if (this.isSigned) throw new VarianceSignoffInvalidError("Variance is already signed off");

        const trimmed = explanation.trim();
        // Chặn "ok", "đã xem": ký mà không giải thích được thì chữ ký vô nghĩa.
        if (trimmed.length < EXPLANATION_MIN_LENGTH) {
            throw new VarianceSignoffInvalidError(`Explanation must be at least ${EXPLANATION_MIN_LENGTH} characters`);
        }
        if (trimmed.length > EXPLANATION_MAX_LENGTH) {
            throw new VarianceSignoffInvalidError(`Explanation must be at most ${EXPLANATION_MAX_LENGTH} characters`);
        }

        this._signedBy    = byUserId;
        this._signedAt    = new Date();
        this._explanation = trimmed;
    }
}
