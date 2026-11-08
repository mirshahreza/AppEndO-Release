import { describe, expect, it } from 'vitest';
import {
  canPerform,
  explainCapabilityDenial,
  getCapabilityRegistryHealth,
  resolveEffectiveCapabilities,
} from '../capabilityRegistryScaffold';

describe('capabilityRegistryScaffold', () => {
  it('bootstraps capabilities from built-in pack catalog', () => {
    const health = getCapabilityRegistryHealth();
    expect(health.capabilityCount).toBeGreaterThanOrEqual(10);
    expect(health.bootstrapContributor).toBe('PlatformRuntimeContributor');
  });

  it('returns denial reason codes for disabled packs in agent mode', () => {
    const resolution = resolveEffectiveCapabilities({
      requestClass: 'TOOL_QUERY',
      mode: 'agent',
      enabledPackIds: ['appendo-files'],
    });

    const denied = resolution.denied.find((entry) => entry.packId === 'appendo-git');
    expect(denied?.authorization).toBe('DENIED');
    expect(denied?.denialReasonCodes).toContain('PACK_NOT_ENABLED');
  });

  it('explains capability denial with structured reason codes', () => {
    const explanation = explainCapabilityDenial('capability:appendo-git', {
      requestClass: 'TOOL_QUERY',
      mode: 'ask',
      enabledPackIds: [],
    });
    expect(explanation.denialReasonCodes.length).toBeGreaterThan(0);
    expect(canPerform('capability:appendo-files', {
      requestClass: 'TOOL_QUERY',
      mode: 'ask',
      enabledPackIds: [],
    }).allowed).toBe(true);
  });
});
