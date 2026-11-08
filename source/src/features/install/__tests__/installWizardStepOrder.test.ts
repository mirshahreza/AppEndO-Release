import { describe, expect, it } from 'vitest';

import { isInstallAdminStepEnabled } from '../installWizardStepOrder';

describe('installWizardStepOrder', () => {
  it('disables admin field editing when override existing objects is off', () => {
    expect(isInstallAdminStepEnabled(false)).toBe(false);
    expect(isInstallAdminStepEnabled(false, 'sqlserver')).toBe(false);
  });

  it('enables admin field editing when override existing objects is on', () => {
    expect(isInstallAdminStepEnabled(true)).toBe(true);
  });

  it('enables admin field editing for sqlite even without override', () => {
    expect(isInstallAdminStepEnabled(false, 'sqlite')).toBe(true);
  });
});
