import { describe, expect, it } from 'vitest';
import { AUTHENTICATED_FUNCTION_ACCESS_CONTROL } from '../../server-functions/accessControl';
import {
  parsePlatformRouteBindingAuth,
  platformAuthFromAccessControl,
} from '../platformAccessControl';

describe('platformAccessControl', () => {
  it('maps null auth to public access control', () => {
    expect(parsePlatformRouteBindingAuth(null).accessMode).toBe('public');
    expect(platformAuthFromAccessControl(parsePlatformRouteBindingAuth(null))).toBeNull();
  });

  it('maps authenticated access control', () => {
    const parsed = parsePlatformRouteBindingAuth(AUTHENTICATED_FUNCTION_ACCESS_CONTROL);
    expect(parsed.accessMode).toBe('authenticated');
    expect(platformAuthFromAccessControl(parsed)?.accessMode).toBe('authenticated');
  });

  it('maps specific allowRoles', () => {
    const parsed = parsePlatformRouteBindingAuth({
      accessMode: 'specific',
      allowRoles: ['ADMIN', 'DEVELOPER'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    });
    expect(parsed.accessMode).toBe('specific');
    expect(parsed.allowRoles).toEqual(['ADMIN', 'DEVELOPER']);
  });

  it('round-trips canonical function access control', () => {
    const serialized = platformAuthFromAccessControl(AUTHENTICATED_FUNCTION_ACCESS_CONTROL);
    expect(parsePlatformRouteBindingAuth(serialized).accessMode).toBe('authenticated');
  });
});
