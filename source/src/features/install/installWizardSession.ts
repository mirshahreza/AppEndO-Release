import type { InstallProgressState } from './InstallProgressDialog';
import { VISIBLE_INSTALL_WIZARD_STEP_IDS } from './installWizardStepOrder';

const STORAGE_KEY = 'appendo:install-wizard:v1';

/** Wizard position is never restored after refresh — always start at welcome. */
export const readInitialInstallWizardState = (): {
  stepIndex: number;
  furthestStepIndex: number;
  installProgress: InstallProgressState | null;
} => {
  clearInstallWizardSession();
  return {
    stepIndex: 0,
    furthestStepIndex: 0,
    installProgress: null,
  };
};

export const clearInstallWizardSession = (): void => {
  try {
    globalThis.sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore unavailable storage (SSR / private mode)
  }
};

export const VISIBLE_WIZARD_STEP_COUNT = VISIBLE_INSTALL_WIZARD_STEP_IDS.length;
