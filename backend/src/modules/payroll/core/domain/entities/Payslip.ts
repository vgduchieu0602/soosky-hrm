import { ComputePayrollResult } from "@modules/payroll/core/domain/services/salary-calc";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export const PAYSLIP_STATUSES = ["draft", "approved", "paid"] as const;
export type PayslipStatus = (typeof PAYSLIP_STATUSES)[number];

export interface PayslipWorkdays {
    standardWorkDays: number;
    actualWorkDays:   number;
    /** Nghỉ không lương + vắng mặt trong kỳ. */
    unpaidDays:       number;
}

/**
 * Một dòng lương theo ĐOẠN hợp đồng. Hiện trên phiếu để nhân viên đọc được
 * "nửa đầu tháng thử việc 85%, nửa sau chính thức" thay vì một con số bình quân
 * không giải thích được.
 */
export interface PayslipSegment {
    contractId:         string;
    contractNumber:     string;
    employmentStatus:   string;
    from:               Date;
    to:                 Date;
    workDays:           number;
    /** Lương cơ bản trên hợp đồng, TRƯỚC khi áp tỷ lệ thử việc. */
    baseSalary:         number;
    /** Sau khi áp tỷ lệ thử việc của chính sách. */
    effectiveBase:      number;
    attendanceRatio:    number;
    /** Phần lương theo công mà đoạn này đóng góp vào kỳ. */
    proRatedBaseSalary: number;
}

/**
 * BẢN CHỤP đầu vào đã dùng để tính phiếu này.
 *
 * Không có nó thì sáu tháng sau không ai trả lời được "vì sao số này ra thế":
 * chính sách lương đã đổi phiên bản, phụ cấp đã hết hiệu lực, hồ sơ thuế đã
 * cập nhật. Lưu id của đúng những bản ghi đã dùng là cách duy nhất tái lập lại
 * được phép tính.
 */
export interface PayslipInputs {
    /** Phiên bản công thức (`PAYROLL_ENGINE_VERSION`) lúc tính. */
    engineVersion:  string;
    salaryPolicyId: string;
    /** `null` = nhân viên chưa có hồ sơ thuế (BHXH 0, không giảm trừ người phụ thuộc). */
    taxProfileId:   string | null;
    allowanceIds:   string[];
    bonusIds:       string[];
    deductionIds:   string[];
    /** Nhiều id khi có đổi hợp đồng giữa kỳ. */
    contractIds:    string[];
    /** Điều chỉnh hồi tố đã tính vào phiếu này (truy lĩnh + truy thu). */
    retroIds:       string[];
    /** Người chạy tính lương lần này. */
    computedBy:     string;
    /**
     * Số lần đã tính lại. > 0 nghĩa là đầu vào đã bị sửa sau lần tính đầu —
     * dấu hiệu người duyệt cần soi lại.
     */
    recomputeCount: number;
}

export interface PayslipCreationInput {
    id:               string;
    payrollPeriodId:  string;
    employeeId:       string;
    workdays:         PayslipWorkdays;
    attendanceRatio:  number;
    performanceRatio: number;
    goalRatio:        number;
    /**
     * Toàn bộ kết quả tính từ `computePayroll` — lưu NGUYÊN dạng lồng thay vì
     * làm phẳng ~30 cột như bản Mongoose cũ: driver Mongo thô lưu sub-document
     * tự nhiên, không cần schema cột phẳng. Giữ đúng từng con số, chỉ khác tổ
     * chức lưu trữ (xem payroll-report.md).
     */
    breakdown:        ComputePayrollResult;
    /** Rỗng khi cả kỳ chỉ có một hợp đồng (đường đi thường gặp). */
    segments:         PayslipSegment[];
    inputs:           PayslipInputs;
}

export type PayslipProps = Omit<PayslipCreationInput, "segments"> & {
    /** Vắng mặt trên document cũ (tính trước khi có tách đoạn hợp đồng). */
    segments?:   PayslipSegment[];
    status:      PayslipStatus;
    approvedBy:  string | null;
    paidAt:      Date | null;
    computedAt:  Date;
    createdAt:   Date;
};

/**
 * Aggregate phiếu lương — một dòng lương của MỘT nhân viên trong MỘT kỳ.
 * Vòng đời `draft` → `approved` → `paid`; recompute chỉ hợp lệ khi còn
 * `draft` (guard ở tầng use-case, cần biết ngữ cảnh kỳ lương).
 */
export default class Payslip extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        public readonly payrollPeriodId: string,
        public readonly employeeId: string,
        private _workdays: PayslipWorkdays,
        private _attendanceRatio: number,
        private _performanceRatio: number,
        private _goalRatio: number,
        private _breakdown: ComputePayrollResult,
        private _segments: PayslipSegment[],
        private _inputs: PayslipInputs,
        private _status: PayslipStatus,
        private _approvedBy: string | null,
        private _paidAt: Date | null,
        private _computedAt: Date,
    ) {
        super();
    }

    get workdays(): PayslipWorkdays { return this._workdays; }
    get attendanceRatio(): number { return this._attendanceRatio; }
    get performanceRatio(): number { return this._performanceRatio; }
    get goalRatio(): number { return this._goalRatio; }
    get breakdown(): ComputePayrollResult { return this._breakdown; }
    get segments(): readonly PayslipSegment[] { return this._segments.map(s => ({ ...s })); }
    get inputs(): PayslipInputs { return { ...this._inputs, allowanceIds: [...this._inputs.allowanceIds], bonusIds: [...this._inputs.bonusIds], deductionIds: [...this._inputs.deductionIds], contractIds: [...this._inputs.contractIds], retroIds: [...(this._inputs.retroIds ?? [])] }; }
    get status(): PayslipStatus { return this._status; }
    get approvedBy(): string | null { return this._approvedBy; }
    get paidAt(): Date | null { return this._paidAt; }
    get computedAt(): Date { return this._computedAt; }
    get netSalary(): number { return this._breakdown.netSalary; }
    get grossSalary(): number { return this._breakdown.grossSalary; }

    static compute(input: PayslipCreationInput): Payslip {
        return new Payslip(
            input.id, new Date(), input.payrollPeriodId, input.employeeId,
            input.workdays, input.attendanceRatio, input.performanceRatio, input.goalRatio,
            input.breakdown, input.segments, input.inputs, "draft", null, null, new Date(),
        );
    }

    static rehydrate(props: PayslipProps): Payslip {
        return new Payslip(
            props.id, props.createdAt, props.payrollPeriodId, props.employeeId,
            props.workdays, props.attendanceRatio, props.performanceRatio, props.goalRatio,
            props.breakdown, props.segments ?? [], props.inputs, props.status, props.approvedBy, props.paidAt, props.computedAt,
        );
    }

    /** Tính lại phiếu lương draft với dữ liệu mới — không đổi danh tính/kỳ/nhân viên. */
    recompute(input: Omit<PayslipCreationInput, "id" | "payrollPeriodId" | "employeeId">): void {
        this._workdays = input.workdays;
        this._attendanceRatio = input.attendanceRatio;
        this._performanceRatio = input.performanceRatio;
        this._goalRatio = input.goalRatio;
        this._breakdown = input.breakdown;
        this._segments = input.segments;
        // Đếm dồn: `recomputeCount` của lần tính mới = lần trước + 1. Caller chỉ
        // cần dựng `inputs` như bình thường, không phải tự nhớ số cũ.
        this._inputs = { ...input.inputs, recomputeCount: this._inputs.recomputeCount + 1 };
        this._computedAt = new Date();
    }

    approve(approverUserId: string): void {
        this._status = "approved";
        this._approvedBy = approverUserId;
    }

    revertToDraft(): void {
        this._status = "draft";
        this._approvedBy = null;
    }

    markPaid(paidAt: Date): void {
        this._status = "paid";
        this._paidAt = paidAt;
    }
}
