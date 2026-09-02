// Public surface of the payroll feature (Clean Architecture).
export { default as payrollRouter } from '@features/payroll/interfaces/http/payroll.routes';

// Periods are owned by the `period` feature; re-export its router + use-cases
// so the app can mount them and tests/legacy callers keep working.
export { periodRouter, periodUseCases } from '@features/period/container';

// Use-cases re-exported under their legacy service/function names for callers
// and tests that depend on the previous public surface.
export {
  payrollUseCases as payrollService,
  allowanceUseCases as allowanceService,
  bonusUseCases as bonusService,
  deductionUseCases as deductionService,
  taxProfileUseCases as taxProfileService,
  runPayrollForEmployee,
  runPayrollForPeriod,
  approvePayroll,
  revertPayrollToDraft,
  markPeriodPaid,
} from '@features/payroll/container';
