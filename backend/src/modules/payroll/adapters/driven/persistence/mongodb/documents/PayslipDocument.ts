import { PayslipStatus, PayslipWorkdays } from "@modules/payroll/core/domain/entities/Payslip";
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
    status:           PayslipStatus;
    approvedBy:       string | null;
    paidAt:           Date | null;
    computedAt:       Date;
    createdAt:        Date;
}
