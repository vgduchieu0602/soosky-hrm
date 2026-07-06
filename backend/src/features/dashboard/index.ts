// Public surface of the dashboard feature (Clean Architecture).
export { default as dashboardRouter } from '@features/dashboard/interfaces/http/dashboard.routes';

// Re-exported under the legacy service name for cross-feature/test callers.
export { dashboardUseCases as dashboardService } from '@features/dashboard/container';
