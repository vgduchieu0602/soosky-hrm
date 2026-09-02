// Public surface of the `period` feature (HR period / payroll-periods owner).
export { periodRouter, periodUseCases, periodGateway } from './container';

export * from './domain/ports';
export { PayrollPeriod, type PayrollPeriodStatus, PAYROLL_PERIOD_STATUS } from './infrastructure/period.schema';
export type { IPayrollPeriod } from './domain/ports';
