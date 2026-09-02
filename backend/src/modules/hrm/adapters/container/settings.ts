/**
 * Composition root — the only place that knows about concrete adapters.
 * Wires infrastructure implementations into the application use-cases and
 * exposes them as a ready-to-use container for the HTTP layer.
 */
import {
  MongooseCompanyConfigRepository,
  MongooseSalaryPolicyRepository,
  MongoosePerformanceCriterionRepository,
  MongooseBankRepository,
} from '@modules/hrm/adapters/persistence/mongoose/settings/settings.repositories';
import { AuditServiceAdapter } from '@modules/hrm/adapters/services/settings.services';
import {
  CompanyConfigUseCases,
  SalaryPolicyUseCases,
  PerformanceCriterionUseCases,
  BankUseCases,
} from '@modules/hrm/core/settings/app/settings.usecases';

// --- infrastructure ---
const companyConfigRepo = new MongooseCompanyConfigRepository();
const salaryPolicyRepo = new MongooseSalaryPolicyRepository();
const performanceCriterionRepo = new MongoosePerformanceCriterionRepository();
const bankRepo = new MongooseBankRepository();

const audit = new AuditServiceAdapter();

// --- application ---
export const companyConfigUseCases = new CompanyConfigUseCases(companyConfigRepo, audit);
export const salaryPolicyUseCases = new SalaryPolicyUseCases(salaryPolicyRepo, audit);
export const performanceCriterionUseCases = new PerformanceCriterionUseCases(performanceCriterionRepo, audit);
export const bankUseCases = new BankUseCases(bankRepo, audit);
