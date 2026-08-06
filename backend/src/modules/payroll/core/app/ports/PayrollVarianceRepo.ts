import PayrollVariance from "@modules/payroll/core/domain/entities/PayrollVariance";

export default interface PayrollVarianceRepo {
    listByPeriod(payrollPeriodId: string): Promise<PayrollVariance[]>;
    findOne(payrollPeriodId: string, employeeId: string): Promise<PayrollVariance | undefined>;
    /** Số chênh lệch CHƯA ký của kỳ — cổng chặn HR soát/duyệt. */
    countUnsigned(payrollPeriodId: string): Promise<number>;
    save(variance: PayrollVariance): Promise<void>;
    /** Xoá khi chạy lại đối soát mà hai engine đã cho ra cùng con số. */
    deleteOne(payrollPeriodId: string, employeeId: string): Promise<void>;
}
