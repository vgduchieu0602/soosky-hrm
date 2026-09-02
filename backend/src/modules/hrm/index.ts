/**
 * Public surface of the HRM module.
 *
 * Everything the rest of the application (server bootstrap, other modules,
 * scripts) may touch is exported here — nothing else inside `modules/hrm` is
 * meant to be imported from the outside. Code *within* the module imports the
 * concrete file it needs instead of going through this barrel.
 */

// ---- HTTP routers ----
export { default as employeeRouter } from '@modules/hrm/adapters/http/employee/employee.routes';
export { default as organizationRouter } from '@modules/hrm/adapters/http/organization/organization.routes';
export { default as settingsRouter } from '@modules/hrm/adapters/http/settings/settings.routes';
export { default as attendanceRouter } from '@modules/hrm/adapters/http/attendance/attendance.routes';
export { default as payrollRouter } from '@modules/hrm/adapters/http/payroll/payroll.routes';
export { default as performanceRouter } from '@modules/hrm/adapters/http/performance/performance.routes';
export { default as storageRouter } from '@modules/hrm/adapters/http/storage/storage.routes';
export { default as notificationRouter } from '@modules/hrm/adapters/http/notification/notification.routes';
export { default as dashboardRouter } from '@modules/hrm/adapters/http/dashboard/dashboard.routes';
export { periodRouter } from '@modules/hrm/adapters/container/period';

// ---- Event listeners / scheduled jobs ----
export { registerNotificationListeners } from '@modules/hrm/adapters/listeners/notification.listener';
export { registerAccountEmailListeners } from '@modules/hrm/adapters/listeners/account-email.listener';
export { registerReminderJobs } from '@modules/hrm/adapters/jobs/reminder.job';

// ---- Use-cases, re-exported under the legacy service names external callers
// and tests already use. The composition root is the only place that
// instantiates adapters. ----
export {
  employeeService,
  accountProvisioningService,
  employeeAccountService,
  employeeContractService,
  employeeDocumentService,
  employeeContactService,
  employeeBankAccountService,
  employeeAssetService,
  employeeHistoryService,
} from '@modules/hrm/adapters/container/employee';

export {
  departmentUseCases as departmentService,
  positionUseCases as positionService,
} from '@modules/hrm/adapters/container/organization';

export {
  companyConfigUseCases as companyConfigService,
  salaryPolicyUseCases as salaryPolicyService,
  performanceCriterionUseCases as performanceCriterionService,
} from '@modules/hrm/adapters/container/settings';

export {
  shiftUseCases as shiftService,
  holidayUseCases as holidayService,
  symbolUseCases as symbolService,
  attendanceUseCases,
  leaveUseCases,
  leaveEntitlement,
} from '@modules/hrm/adapters/container/attendance';

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
} from '@modules/hrm/adapters/container/payroll';

export { evaluationUseCases as evaluationService } from '@modules/hrm/adapters/container/performance';
export { dashboardUseCases as dashboardService } from '@modules/hrm/adapters/container/dashboard';
export { notificationService } from '@modules/hrm/adapters/container/notification';
export { storageUseCases as storageService } from '@modules/hrm/adapters/container/storage';
export { periodUseCases, periodGateway } from '@modules/hrm/adapters/container/period';

// ---- Pure domain helpers callers/tests use directly ----
export { computeEvaluationRatio, type ScoreInput } from '@modules/hrm/core/performance/domain/evaluation-ratio';
export * from '@modules/hrm/core/period/domain/ports';
export {
  PayrollPeriod,
  type PayrollPeriodStatus,
  PAYROLL_PERIOD_STATUS,
} from '@modules/hrm/adapters/persistence/mongoose/period/period.schema';
