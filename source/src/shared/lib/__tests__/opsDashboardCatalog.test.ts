import { describe, expect, it } from 'vitest';
import { assertPivotSpecInDomain, DashboardDomainWhitelistError } from '../dashboardCanvas';
import {
  OPS_DASHBOARD_DENIED_FIELDS,
  OPS_DASHBOARD_MODELS,
  assertOpsDashboardExposedFields,
  findOpsDashboardModel,
  isOpsDashboardDeniedField,
  opsDashboardExposedFields,
} from '../opsDashboardCatalog';

describe('opsDashboardCatalog', () => {
  it('rejects deny-listed and secret-shaped field names', () => {
    expect(() => assertOpsDashboardExposedFields(['password_hash'])).toThrow(/password_hash/);
    expect(() => assertOpsDashboardExposedFields(['message'])).toThrow(/message/);
    expect(() => assertOpsDashboardExposedFields(['email'])).toThrow(/email/);
    expect(() => assertOpsDashboardExposedFields(['options_json'])).toThrow(/options_json/);
    expect(isOpsDashboardDeniedField('api_token')).toBe(true);
    expect(isOpsDashboardDeniedField('username')).toBe(false);
  });

  it('whitelists every catalog column and none of the deny-list', () => {
    for (const spec of OPS_DASHBOARD_MODELS) {
      const fields = opsDashboardExposedFields(spec);
      expect(assertOpsDashboardExposedFields(fields)).toEqual(fields);
      for (const denied of OPS_DASHBOARD_DENIED_FIELDS) {
        expect(fields).not.toContain(denied);
      }
    }
  });

  it('rejects a pivot field outside the jobs whitelist', () => {
    const jobs = findOpsDashboardModel('ops_jobs');
    expect(jobs).toBeDefined();
    expect(() => assertPivotSpecInDomain({
      personalizable: false,
      domain: [{
        id: 'ops_jobs',
        dataSourceRef: 'ds',
        exposedFields: opsDashboardExposedFields(jobs!),
      }],
    }, 'ops_jobs', {
      rows: [{ field: 'status' }],
      columns: [],
      measures: [{ field: 'message', aggregation: 'count' }],
    })).toThrow(DashboardDomainWhitelistError);
  });
});
