// API công khai của module Payroll.
// Chỉ những symbol export ở đây mới truy cập được từ các module khác.

export { createPayrollHttpRouter } from "@modules/payroll/adapters/driver/http";
export type { PayrollHttpUseCases } from "@modules/payroll/adapters/driver/http";
export { createPayrollPeriodLockDirectory } from "@modules/payroll/composition";
export type { PayrollPeriodLockDirectory } from "@modules/payroll/composition";
export { createPayrollEvaluationSink } from "@modules/payroll/composition";
export type { PayrollEvaluationSnapshotSink } from "@modules/payroll/composition";
export { createPayrollReportDirectory } from "@modules/payroll/composition";
export type { PayrollPeriodSnapshot, PayrollReportDirectory } from "@modules/payroll/composition";
