import { EmployeeEvaluation, PayrollPeriodStage, PayrollPeriodStatus } from "@modules/payroll/core/domain/entities/PayrollPeriod";

/** Dạng document lưu trữ của aggregate `PayrollPeriod`. */
export default interface PayrollPeriodDocument {
    _id:                 string;
    name:                string;
    startDate:           Date;
    endDate:             Date;
    payDate:             Date;
    standardWorkDays:    number;
    status:              PayrollPeriodStatus;
    /** Vắng mặt trên document cũ -> mapper suy ra từ `status`. */
    stage?:              PayrollPeriodStage;
    hrReviewedBy?:       string | null;
    hrReviewedAt?:       Date | null;
    closedAt:            Date | null;
    closedBy:            string | null;
    attendanceLockedAt:  Date | null;
    attendanceLockedBy:  string | null;
    evaluationLockedAt:  Date | null;
    evaluationLockedBy:  string | null;
    /** Vắng mặt trên document cũ -> mapper đọc thành null (chưa từng chạy tính lương). */
    preparedBy?:         string | null;
    preparedAt?:         Date | null;
    createdBy:           string | null;
    createdAt:           Date;
    evaluations?:        EmployeeEvaluation[];
}
