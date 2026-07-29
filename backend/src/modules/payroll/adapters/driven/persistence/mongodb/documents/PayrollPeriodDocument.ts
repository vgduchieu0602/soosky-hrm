import { PayrollPeriodStatus } from "@modules/payroll/core/domain/entities/PayrollPeriod";

/** Dạng document lưu trữ của aggregate `PayrollPeriod`. */
export default interface PayrollPeriodDocument {
    _id:                 string;
    name:                string;
    startDate:           Date;
    endDate:             Date;
    payDate:             Date;
    standardWorkDays:    number;
    status:              PayrollPeriodStatus;
    closedAt:            Date | null;
    closedBy:            string | null;
    attendanceLockedAt:  Date | null;
    attendanceLockedBy:  string | null;
    evaluationLockedAt:  Date | null;
    evaluationLockedBy:  string | null;
    createdBy:           string | null;
    createdAt:           Date;
}
