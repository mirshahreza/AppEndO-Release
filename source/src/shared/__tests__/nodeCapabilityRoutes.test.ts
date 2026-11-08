import { describe, expect, it } from 'vitest';
import {
  buildNodeCapabilityDeniedMessage,
  nodeSatisfiesRouteCapabilities,
  resolveApiRouteCapabilities,
} from '../nodeCapabilityRoutes';

describe('nodeCapabilityRoutes', () => {
  it('treats health, install, and auth as universal', () => {
    expect(resolveApiRouteCapabilities('/api/health')).toEqual({ required: null });
    expect(resolveApiRouteCapabilities('/api/install/status')).toEqual({ required: null });
    expect(resolveApiRouteCapabilities('/api/auth/login')).toEqual({ required: null });
    expect(resolveApiRouteCapabilities('/api/platform/runtime-config')).toEqual({ required: null });
    expect(resolveApiRouteCapabilities('/api/platform/cultures', 'GET')).toEqual({ required: null });
    expect(resolveApiRouteCapabilities('/api/cms-site/public', 'GET')).toEqual({ required: null });
  });

  it('requires worker for jobs and scheduler', () => {
    expect(resolveApiRouteCapabilities('/api/jobs')).toEqual({ required: ['worker'] });
    expect(resolveApiRouteCapabilities('/api/scheduler/tasks')).toEqual({ required: ['worker'] });
  });

  it('requires platform for studio routes', () => {
    expect(resolveApiRouteCapabilities('/api/settings/general')).toEqual({ required: ['platform'] });
    expect(resolveApiRouteCapabilities('/api/platform/portals')).toEqual({ required: ['platform'] });
    expect(resolveApiRouteCapabilities('/api/packages')).toEqual({ required: ['platform'] });
  });

  it('allows package runtime assets on service or platform nodes', () => {
    expect(resolveApiRouteCapabilities('/api/packages/pkg-1/assets/logo.png')).toEqual({
      required: ['service', 'platform'],
    });
    expect(resolveApiRouteCapabilities('/api/packages/pkg-1/ui/home')).toEqual({
      required: ['service', 'platform'],
    });
  });

  it('defaults unknown api paths to service capability', () => {
    expect(resolveApiRouteCapabilities('/api/general/products')).toEqual({ required: ['service'] });
  });

  it('checks active capabilities with OR semantics', () => {
    expect(nodeSatisfiesRouteCapabilities(['service'], ['service', 'platform'])).toBe(true);
    expect(nodeSatisfiesRouteCapabilities(['platform'], ['service', 'platform'])).toBe(true);
    expect(nodeSatisfiesRouteCapabilities(['worker'], ['service', 'platform'])).toBe(false);
    expect(nodeSatisfiesRouteCapabilities(['worker'], ['worker'])).toBe(true);
    expect(nodeSatisfiesRouteCapabilities(['platform'], null)).toBe(true);
  });

  it('builds denial messages', () => {
    expect(buildNodeCapabilityDeniedMessage(['worker'])).toContain('worker');
    expect(buildNodeCapabilityDeniedMessage(['service', 'platform'])).toContain('service or platform');
  });
});
