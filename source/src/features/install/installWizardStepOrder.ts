import type { InstallWizardStepId } from './installWizardSteps';
import type { ControlPlaneProviderId } from '../../shared/api/contracts/install/controlPlaneProviders';

export const VISIBLE_INSTALL_WIZARD_STEP_IDS: InstallWizardStepId[] = [
  'welcome',
  'capabilities',
  'cache',
  'database',
  'admin',
  'email',
  'summary',
];

/**
 * Admin fields are required when replacing an existing control-plane schema,
 * and always for SQLite (a new file has no usable admin account).
 */
export const isInstallAdminStepEnabled = (
  overrideExistingObjects: boolean,
  provider?: ControlPlaneProviderId | string,
): boolean => overrideExistingObjects || provider === 'sqlite';
