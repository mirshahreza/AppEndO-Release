import { describe, expect, it } from 'vitest';
import {
  STUDIO_PORTAL_SEGMENT,
  BUILT_IN_STUDIO_SHELL_ENTRY,
  BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY,
  toPortalRelativePattern,
  toPortalRoutePattern,
} from '../mountConstants';

describe('mountConstants route pattern helpers', () => {
  it('defines canonical shell and application route constants', () => {
    expect(STUDIO_PORTAL_SEGMENT).toBe('studio');
    expect(BUILT_IN_STUDIO_SHELL_ENTRY).toBe('core:AdminLayout');
    expect(BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY).toBe('core:ComponentAlone');
  });

  it('maps studio dashboard to application namespace on culture mounts', () => {
    expect(toPortalRoutePattern('')).toBe(STUDIO_PORTAL_SEGMENT);
    expect(toPortalRelativePattern(STUDIO_PORTAL_SEGMENT)).toBe('');
  });

  it('prefixes studio route segments with application namespace for culture mounts', () => {
    expect(toPortalRoutePattern('users')).toBe('studio/users');
    expect(toPortalRoutePattern('settings/*')).toBe('studio/settings/*');
    expect(toPortalRoutePattern('studio/users')).toBe('studio/users');
    expect(toPortalRoutePattern('studio')).toBe('studio');
    expect(toPortalRelativePattern('studio/users')).toBe('users');
    expect(toPortalRelativePattern('studio/settings/*')).toBe('settings/*');
  });
});
