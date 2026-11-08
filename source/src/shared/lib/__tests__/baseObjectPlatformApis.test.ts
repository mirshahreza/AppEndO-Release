import { describe, expect, it } from 'vitest';
import {
  BASE_OBJECT_PLATFORM_APIS,
  bestPlatformBasePathForPath,
  listObjectNamesForPlatformApi,
  listPlatformApisForObject,
  platformPathBelongsToObject,
} from '../baseObjectPlatformApis';

describe('listPlatformApisForObject', () => {
  it('lists the Logs API on base_logs_app', () => {
    const apis = listPlatformApisForObject('base_logs_app');
    expect(apis.map((item) => item.basePath)).toContain('/api/logs');
    expect(apis[0]?.label).toBe('Application Logs');
  });

  it('lists Users, Auth, and Profile on base_users', () => {
    expect(listPlatformApisForObject('base_users').map((item) => item.basePath)).toEqual([
      '/api/users',
      '/api/auth',
      '/api/profile',
    ]);
  });

  it('matches object names case-insensitively', () => {
    expect(listPlatformApisForObject('BASE_INFO').map((item) => item.basePath)).toEqual([
      '/api/base-info',
    ]);
  });

  it('returns empty for unknown or blank names', () => {
    expect(listPlatformApisForObject('cms_contents')).toEqual([]);
    expect(listPlatformApisForObject('')).toEqual([]);
    expect(listPlatformApisForObject('   ')).toEqual([]);
  });

  it('lists the auth audit API on base_logs_auth_audit', () => {
    expect(listPlatformApisForObject('base_logs_auth_audit').map((item) => item.basePath)).toEqual([
      '/api/auth/audit-logs',
    ]);
  });

  it('omits tables that still have no HTTP surface', () => {
    expect(listPlatformApisForObject('base_contact_messages')).toEqual([]);
  });

  it('lists object names that expose a platform API key', () => {
    expect(listObjectNamesForPlatformApi('platform-users')).toEqual(
      expect.arrayContaining(['base_users']),
    );
    expect(listObjectNamesForPlatformApi('')).toEqual([]);
  });
});

describe('platformPathBelongsToObject', () => {
  it('keeps the longest prefix so attributes stay off settings sections', () => {
    expect(bestPlatformBasePathForPath('/api/settings/attributes/1')).toBe('/api/settings/attributes');
    expect(platformPathBelongsToObject('/api/settings/attributes', 'base_settings_attributes')).toBe(true);
    expect(platformPathBelongsToObject('/api/settings/attributes', 'base_settings_sections')).toBe(false);
    expect(platformPathBelongsToObject('/api/auth/audit-logs', 'base_users')).toBe(false);
    expect(platformPathBelongsToObject('/api/auth/audit-logs', 'base_logs_auth_audit')).toBe(true);
  });
});

describe('BASE_OBJECT_PLATFORM_APIS', () => {
  it('uses lowercase base_ object names and unique keys per object', () => {
    for (const [objectName, apis] of Object.entries(BASE_OBJECT_PLATFORM_APIS)) {
      expect(objectName).toMatch(/^base_[a-z0-9_]+$/);
      const keys = apis.map((item) => item.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
