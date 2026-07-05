// Public surface of the settings feature (Clean Architecture).
export { default as settingsRouter } from '@features/settings/interfaces/http/settings.routes';

// Use-cases re-exported under their legacy service names for external callers.
export {
  companyConfigUseCases as companyConfigService,
  salaryPolicyUseCases as salaryPolicyService,
  performanceCriterionUseCases as performanceCriterionService,
} from '@features/settings/container';
