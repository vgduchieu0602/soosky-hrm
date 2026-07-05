// Public surface of the organization feature (Clean Architecture).
export { default as organizationRouter } from '@features/organization/interfaces/http/organization.routes';

// Use-cases re-exported under their legacy service names for cross-feature callers.
export {
  departmentUseCases as departmentService,
  positionUseCases as positionService,
} from '@features/organization/container';
