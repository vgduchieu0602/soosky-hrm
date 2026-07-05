// Public surface of the payroll feature (Clean Architecture).
export { default as payrollRouter } from '@features/payroll/interfaces/http/payroll.routes';

// Use-cases re-exported under their legacy service/function names for callers
// and tests that depend on the previous public surface.
export {
  payrollPeriodUseCases as payrollPeriodService,
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
