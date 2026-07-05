// Public surface of the employee feature (Clean Architecture).
export { default as employeeRouter } from '@features/employee/interfaces/http/employee.routes';

// Use-cases re-exported under their legacy service names for cross-feature/test
// callers (the composition root is the only place that instantiates adapters).
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
} from '@features/employee/container';
