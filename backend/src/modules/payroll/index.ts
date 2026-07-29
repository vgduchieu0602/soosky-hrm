// API công khai của module Payroll.
// Chỉ những symbol export ở đây mới truy cập được từ các module khác.

export { createPayrollHttpRouter } from "@modules/payroll/adapters/driver/http";
export type { PayrollHttpUseCases } from "@modules/payroll/adapters/driver/http";
