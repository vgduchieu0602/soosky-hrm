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
}

export type PayslipProps = PayslipCreationInput & {
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
            input.breakdown, "draft", null, null, new Date(),
        );
    }

    static rehydrate(props: PayslipProps): Payslip {
        return new Payslip(
            props.id, props.createdAt, props.payrollPeriodId, props.employeeId,
            props.workdays, props.attendanceRatio, props.performanceRatio, props.goalRatio,
            props.breakdown, props.status, props.approvedBy, props.paidAt, props.computedAt,
        );
    }

    /** Tính lại phiếu lương draft với dữ liệu mới — không đổi danh tính/kỳ/nhân viên. */
    recompute(input: Omit<PayslipCreationInput, "id" | "payrollPeriodId" | "employeeId">): void {
        this._workdays = input.workdays;
        this._attendanceRatio = input.attendanceRatio;
        this._performanceRatio = input.performanceRatio;
        this._goalRatio = input.goalRatio;
        this._breakdown = input.breakdown;
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
