import AppraisalCycle from "@modules/performance/core/domain/entities/AppraisalCycle";

export default interface AppraisalCycleRepo {
    getById(id: string): Promise<AppraisalCycle | undefined>;
    /** Chu kỳ gắn với một kỳ lương — dùng bởi readiness của Payroll. */
    findByPayrollPeriodId(payrollPeriodId: string): Promise<AppraisalCycle | undefined>;
    listAll(): Promise<AppraisalCycle[]>;
    save(cycle: AppraisalCycle): Promise<void>;
}
