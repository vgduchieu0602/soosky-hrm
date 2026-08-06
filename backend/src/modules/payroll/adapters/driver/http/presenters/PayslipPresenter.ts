import Payslip, { PayslipInputs, PayslipSegment, PayslipWorkdays } from "@modules/payroll/core/domain/entities/Payslip";
import { ComputePayrollResult } from "@modules/payroll/core/domain/services/salary-calc";

export interface PayslipDTO {
    id:               string;
    payrollPeriodId:  string;
    employeeId:       string;
    workdays:         PayslipWorkdays;
    attendanceRatio:  number;
    performanceRatio: number;
    goalRatio:        number;
    breakdown:        ComputePayrollResult;
    /**
     * Dòng lương theo từng đoạn hợp đồng. Rỗng khi cả kỳ chỉ có một hợp đồng —
     * giao diện khi đó hiển thị như trước, không cần biết tới khái niệm đoạn.
     */
    segments:         PayslipSegment[];
    /** Bản chụp đầu vào đã dùng để tính — cơ sở truy vết. */
    inputs:           PayslipInputs;
    status:           string;
    approvedBy:       string | null;
    paidAt:           string | null;
    computedAt:       string;
    createdAt:        string;
}

const PayslipPresenter = {
    toDTO(payslip: Payslip): PayslipDTO {
        return {
            id:               payslip.id,
            payrollPeriodId:  payslip.payrollPeriodId,
            employeeId:       payslip.employeeId,
            workdays:         payslip.workdays,
            attendanceRatio:  payslip.attendanceRatio,
            performanceRatio: payslip.performanceRatio,
            goalRatio:        payslip.goalRatio,
            breakdown:        payslip.breakdown,
            segments:         [...payslip.segments],
            inputs:           payslip.inputs,
            status:           payslip.status,
            approvedBy:       payslip.approvedBy,
            paidAt:           payslip.paidAt?.toISOString() ?? null,
            computedAt:       payslip.computedAt.toISOString(),
            createdAt:        payslip.createdAt.toISOString(),
        };
    },
};

export default PayslipPresenter;
