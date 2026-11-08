import { describe, expect, it } from 'vitest';
import { hasPackageCapabilities } from '../packageBuilderCapabilities';
import { APP_SURFACE_BOX_TONE_CLASS, resolveAppSurfaceBoxTone } from '../../../../shared/ui/surfaceClasses';
import { PACKAGE_CAPABILITY_STEP, PACKAGE_CAPABILITY_WIZARD_STEPS } from '../packageCapabilityWizardSteps';
import {
  normalizePackageWorkflowScopeKey,
  packageWorkflowEntryPath,
  packageWorkflowIdentity,
  packageWorkflowLifecycleLabel,
} from '../packageWorkflows';

describe('package workflow packaging helpers', () => {
  it('normalizes identity and zip entry paths', () => {
    expect(normalizePackageWorkflowScopeKey('')).toBe('global');
    expect(packageWorkflowIdentity('global', 'order-approval')).toBe('global/order-approval');
    expect(packageWorkflowEntryPath('global', 'order-approval')).toBe('workflows/global/order-approval.json');
    expect(packageWorkflowLifecycleLabel('ACTIVE')).toBe('Published');
    expect(packageWorkflowLifecycleLabel('DRAFT')).toBe('Draft');
  });

  it('treats workflows as a package capability', () => {
    expect(hasPackageCapabilities({
      apiCount: 0,
      componentCount: 0,
      portalCount: 0,
      shellCount: 0,
      navigationCount: 0,
      workflowCount: 1,
      edgeModelCount: 0,
      edgeApiCount: 0,
      manualFileCount: 0,
      installSql: '',
    })).toBe(true);
  });

  it('places edge data between client components and workflows', () => {
    expect(PACKAGE_CAPABILITY_WIZARD_STEPS[PACKAGE_CAPABILITY_STEP.edgeData]?.title).toBe('Edge Data');
    expect(PACKAGE_CAPABILITY_STEP.workflows).toBe(PACKAGE_CAPABILITY_STEP.edgeData + 1);
    expect(PACKAGE_CAPABILITY_STEP.installScripts).toBe(PACKAGE_CAPABILITY_STEP.workflows + 1);
  });

  it('uses only valid surface-box tones on capability steps', () => {
    for (const stepDef of PACKAGE_CAPABILITY_WIZARD_STEPS) {
      if (!stepDef.tone) continue;
      expect(APP_SURFACE_BOX_TONE_CLASS[stepDef.tone], `${stepDef.title} tone "${stepDef.tone}"`).toBeDefined();
    }
    expect(resolveAppSurfaceBoxTone('teal')).toBe('slate');
  });
});
