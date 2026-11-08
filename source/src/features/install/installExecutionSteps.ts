import { lookupEmbeddedEnglish } from '../../core/culture/embeddedTranslationBundles';
import type { InstallStatusResponse } from '../../shared/api/contracts/install/types';
import type { InstallProgressStep } from './InstallProgressDialog';
import {
  getInstallExecutionStepDefs,
  INSTALL_EXECUTION_STEP_IDS,
  type InstallExecutionStepId,
} from './installWizardI18n';

const embeddedInstallT = (key: string): string => lookupEmbeddedEnglish(key);

export const INSTALL_EXECUTION_STEP_DEFS: Array<Pick<InstallProgressStep, 'id' | 'label'>> = (
  getInstallExecutionStepDefs(embeddedInstallT)
);

export const createInstallExecutionSteps = (): InstallProgressStep[] => (
  INSTALL_EXECUTION_STEP_DEFS.map((step) => ({
    ...step,
    status: 'pending',
  }))
);

export type InstallExecutionSkipFlags = Record<InstallExecutionStepId, boolean>;

/** Skip install batch steps already persisted on the server (safe retry after dev reload). */
export const resolveInstallExecutionSkipFlags = (
  status: InstallStatusResponse | undefined,
): InstallExecutionSkipFlags => {
  const install = status?.install;
  const topologySaved = Boolean(install?.capabilities?.length && install?.nodeName);
  const databaseReady = Boolean(install?.databaseInitialized);
  const cacheConfigured = Boolean(status?.defaultCache);
  const emailReady = Boolean(install?.emailConfigured);

  return {
    capabilities: topologySaved,
    database: databaseReady,
    schema: databaseReady,
    cache: cacheConfigured,
    email: emailReady,
    admin: false,
    complete: false,
  };
};

export const createInstallExecutionStepsWithSkips = (
  skip: InstallExecutionSkipFlags,
): InstallProgressStep[] => (
  INSTALL_EXECUTION_STEP_DEFS.map((step) => ({
    ...step,
    status: skip[step.id as InstallExecutionStepId] ? 'done' : 'pending',
  }))
);

export { INSTALL_EXECUTION_STEP_IDS };
