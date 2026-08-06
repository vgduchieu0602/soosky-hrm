import { PayslipInputs, PayslipSegment, PayslipStatus, PayslipWorkdays } from "@modules/payroll/core/domain/entities/Payslip";
import { ComputePayrollResult } from "@modules/payroll/core/domain/services/salary-calc";

/** Dạng document lưu trữ của aggregate `Payslip` — `breakdown` lưu nguyên dạng lồng. */
export default interface PayslipDocument {
    _id:              string;
    payrollPeriodId:  string;
    employeeId:       string;
    workdays:         PayslipWorkdays;
    attendanceRatio:  number;
    performanceRatio: number;
    goalRatio:        number;
    breakdown:        ComputePayrollResult;
    /** Vắng mặt trên document cũ → mapper đọc thành mảng rỗng. */
    segments?:        PayslipSegment[];
    /**
     * Vắng mặt trên document cũ (tính trước khi có bản chụp đầu vào) → mapper
     * dựng bản chụp "không rõ" thay vì nổ, để phiếu cũ vẫn đọc được.
     */
    inputs?:          PayslipInputs;
    status:           PayslipStatus;
    approvedBy:       string | null;
    paidAt:           Date | null;
    computedAt:       Date;
    createdAt:        Date;
}
