/**
 * Composition root — the only place that knows about concrete adapters. Wires
 * infrastructure implementations into the application use-cases and exposes them
 * as a ready-to-use container for the HTTP layer.
 */
import {
  MongooseEmployeeRepository,
  MongooseEmployeeProfileRepository,
  MongooseContactRepository,
  MongooseBankAccountRepository,
  MongooseDocumentRepository,
  MongooseAssetRepository,
  MongooseContractRepository,
  MongooseHistoryRepository,
} from '@modules/hrm/adapters/persistence/mongoose/employee/repositories';
import {
  MongooseOrganizationGateway,
  MongooseAccountGateway,
  MongooseLeaveSeedGateway,
  MongooseCascadeGateway,
  NotificationServiceGateway,
  MongooseCompletenessGateway,
  MongooseReminderRepository,
} from '@modules/hrm/adapters/persistence/mongoose/employee/gateways';
import { XlsxEmployeeExporter } from '@modules/hrm/adapters/files/employee-exporter';
import { CsvEmployeeExporter } from '@modules/hrm/adapters/files/employee-csv';
import {
  SystemClock,
  AuditServiceAdapter,
  EventBusAdapter,
  MongooseUnitOfWork,
} from '@modules/hrm/adapters/services/employee.services';

import { HistoryUseCases } from '@modules/hrm/core/employee/app/history.usecases';
import { EmployeeUseCases } from '@modules/hrm/core/employee/app/employee.usecases';
import { AccountProvisioningUseCases } from '@modules/hrm/core/employee/app/account-provisioning.usecases';
import { EmployeeAccountUseCases } from '@modules/hrm/core/employee/app/employee-account.usecases';
import {
  ContactUseCases,
  BankAccountUseCases,
  DocumentUseCases,
  AssetUseCases,
  ContractUseCases,
} from '@modules/hrm/core/employee/app/sub-resource.usecases';
import { EmployeeCompletenessUseCases } from '@modules/hrm/core/employee/app/employee-completeness.usecases';
import { EmployeeImportUseCases } from '@modules/hrm/core/employee/app/employee-import.usecases';
import { EmployeeLifecycleUseCases } from '@modules/hrm/core/employee/app/lifecycle.usecases';
import { EmployeeReminderUseCases } from '@modules/hrm/core/employee/app/employee-reminder.usecases';

// --- infrastructure ---
const employeeRepo = new MongooseEmployeeRepository();
const profileRepo = new MongooseEmployeeProfileRepository();
const contactRepo = new MongooseContactRepository();
const bankRepo = new MongooseBankAccountRepository();
const documentRepo = new MongooseDocumentRepository();
const assetRepo = new MongooseAssetRepository();
const contractRepo = new MongooseContractRepository();
const historyRepo = new MongooseHistoryRepository();

const orgGw = new MongooseOrganizationGateway();
const accountGw = new MongooseAccountGateway();
const seedGw = new MongooseLeaveSeedGateway();
const cascadeGw = new MongooseCascadeGateway();
const notificationGw = new NotificationServiceGateway();
const completenessGw = new MongooseCompletenessGateway();
const reminderRepo = new MongooseReminderRepository();
const exporter = new XlsxEmployeeExporter();
const csvExporter = new CsvEmployeeExporter();

const clock = new SystemClock();
const audit = new AuditServiceAdapter();
const events = new EventBusAdapter();
const uow = new MongooseUnitOfWork();

// --- application ---
const history = new HistoryUseCases(historyRepo, clock);

export const employeeHistoryService = history;
export const employeeService = new EmployeeUseCases(
  employeeRepo, profileRepo, orgGw, accountGw, history, seedGw, cascadeGw, exporter, csvExporter, audit, uow,
);
export const employeeLifecycleService = new EmployeeLifecycleUseCases(
  employeeRepo, contractRepo, historyRepo, history, orgGw, accountGw, audit, clock, uow,
);
export const accountProvisioningService = new AccountProvisioningUseCases(
  employeeRepo, profileRepo, accountGw, events, uow,
);
export const employeeAccountService = new EmployeeAccountUseCases(employeeRepo, accountGw, audit, events, uow);
export const employeeContactService = new ContactUseCases(contactRepo, employeeRepo, audit);
export const employeeBankAccountService = new BankAccountUseCases(bankRepo, employeeRepo, audit);
export const employeeDocumentService = new DocumentUseCases(documentRepo, employeeRepo, audit);
export const employeeAssetService = new AssetUseCases(assetRepo, employeeRepo, audit);
export const employeeContractService = new ContractUseCases(contractRepo, employeeRepo, history, audit, uow);
export const employeeCompletenessService = new EmployeeCompletenessUseCases(completenessGw);
export const employeeImportService = new EmployeeImportUseCases(
  employeeService, employeeRepo, contractRepo, bankRepo, orgGw, audit, uow,
);
export const employeeReminderService = new EmployeeReminderUseCases(reminderRepo, notificationGw, clock);
