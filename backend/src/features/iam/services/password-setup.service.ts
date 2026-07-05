/**
 * Compatibility re-export. The password-setup service moved to the Clean
 * Architecture layers (application/password-setup.usecases, wired in container.ts).
 * This shim preserves the historical deep-import path
 * `@features/iam/services/password-setup.service` used by the employee feature.
 */
export { passwordSetupUseCases as passwordSetupService } from '@features/iam/container';
export { buildSetPasswordUrl } from '@features/iam/application/password-setup.usecases';
