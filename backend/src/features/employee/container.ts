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
} from '@features/employee/infrastructure/repositories.mongoose';
import {
  MongooseOrganizationGateway,
  MongooseAccountGateway,
  MongooseLeaveSeedGateway,
  MongooseCascadeGateway,
  NotificationServiceGateway,
  MongooseCompletenessGateway,
  MongooseReminderRepository,
} from '@features/employee/infrastructure/gateways.mongoose';
import { XlsxEmployeeExporter } from '@features/employee/infrastructure/employee-exporter';
import {
  SystemClock,
  AuditServiceAdapter,
  EventBusAdapter,
  MongooseUnitOfWork,
} from '@features/employee/infrastructure/services';

import { HistoryUseCases } from '@features/employee/application/history.usecases';
import { EmployeeUseCases } from '@features/employee/application/employee.usecases';
import { AccountProvisioningUseCases } from '@features/employee/application/account-provisioning.usecases';
import { EmployeeAccountUseCases } from '@features/employee/application/employee-account.usecases';
import {
  ContactUseCases,
  BankAccountUseCases,
  DocumentUseCases,
  AssetUseCases,
  ContractUseCases,
} from '@features/employee/application/sub-resource.usecases';
import { EmployeeCompletenessUseCases } from '@features/employee/application/employee-completeness.usecases';
import { EmployeeImportUseCases } from '@features/employee/application/employee-import.usecases';
import { EmployeeReminderUseCases } from '@features/employee/application/employee-reminder.usecases';

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

const clock = new SystemClock();
const audit = new AuditServiceAdapter();
const events = new EventBusAdapter();
const uow = new MongooseUnitOfWork();

// --- application ---
const history = new HistoryUseCases(historyRepo, clock);

export const employeeHistoryService = history;
export const employeeService = new EmployeeUseCases(
  employeeRepo, profileRepo, orgGw, accountGw, history, seedGw, cascadeGw, exporter, audit, uow,
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
export const employeeImportService = new EmployeeImportUseCases(employeeService, orgGw);
export const employeeReminderService = new EmployeeReminderUseCases(reminderRepo, notificationGw, clock);
