import { describe, expect, it } from 'vitest';
import {
  buildCapabilityEnvGuide,
  normalizeNodeCapabilities,
  nodeRunsBackgroundJobs,
  parseNodeCapabilities,
  resolveActiveNodeCapabilities,
  validateNodeCapabilities,
} from '../../../../shared/nodeCapabilities';

describe('nodeCapabilities', () => {
  it('parses and normalizes capability arrays', () => {
    expect(parseNodeCapabilities(['service', 'worker'])).toEqual(['service', 'worker']);
    expect(parseNodeCapabilities(['invalid'])).toBeNull();
    expect(normalizeNodeCapabilities({ capabilities: ['worker', 'service'] })).toEqual(['service', 'worker']);
  });

  it('maps legacy nodeRole to capabilities', () => {
    expect(normalizeNodeCapabilities({ nodeRole: 'worker' })).toEqual(['worker']);
    expect(normalizeNodeCapabilities({ nodeRole: 'standalone' })).toEqual(['service', 'platform', 'worker']);
  });

  it('requires at least one capability', () => {
    expect(validateNodeCapabilities([])).toEqual({
      valid: false,
      message: 'Select at least one node capability.',
    });
    expect(validateNodeCapabilities(['platform'])).toEqual({ valid: true });
  });

  it('detects background jobs from worker capability', () => {
    expect(nodeRunsBackgroundJobs(['worker'])).toBe(true);
    expect(nodeRunsBackgroundJobs(['service', 'platform'])).toBe(false);
  });

  it('builds env var guides', () => {
    const guide = buildCapabilityEnvGuide(['service', 'platform'], 'node-a');
    expect(guide.some((item) => item.key === 'APPENDO_NODE_CAPABILITIES' && item.value === 'service,platform')).toBe(true);
    expect(guide.some((item) => item.key === 'APPENDO_NODE_NAME' && item.value === 'node-a')).toBe(true);
  });

  it('prefers APPENDO_NODE_CAPABILITIES env override', () => {
    const previous = process.env.APPENDO_NODE_CAPABILITIES;
    process.env.APPENDO_NODE_CAPABILITIES = 'service,worker';
    try {
      expect(resolveActiveNodeCapabilities({ capabilities: ['platform'] })).toEqual(['service', 'worker']);
    } finally {
      if (previous === undefined) {
        delete process.env.APPENDO_NODE_CAPABILITIES;
      } else {
        process.env.APPENDO_NODE_CAPABILITIES = previous;
      }
    }
  });
});
