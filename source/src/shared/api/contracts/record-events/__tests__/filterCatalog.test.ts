import { describe, expect, it } from 'vitest';
import {
  RECORD_EVENT_FILTER_ALL,
  RECORD_EVENT_NO_MATCH_KIND,
  commitRecordEventFilterValue,
  listRecordEventDataApiFilters,
  listRecordEventPlatformApiFilters,
  mergeRecordEventEntityOptions,
  resolveRecordEventSubjectKinds,
  subjectKindsForRecordEventApiFilter,
  toDataApiFilterValue,
  toRecordEventListKindParams,
} from '../filterCatalog';

describe('resolveRecordEventSubjectKinds', () => {
  it('returns undefined when neither entity nor API kinds are set', () => {
    expect(resolveRecordEventSubjectKinds({})).toBeUndefined();
  });

  it('uses the entity when set', () => {
    expect(resolveRecordEventSubjectKinds({ subjectKind: 'base_users' })).toEqual(['base_users']);
  });

  it('uses the API CSV when entity is empty', () => {
    expect(resolveRecordEventSubjectKinds({ subjectKinds: 'base_users,base_roles' })).toEqual([
      'base_users',
      'base_roles',
    ]);
  });

  it('returns empty when entity is not in the API kinds', () => {
    expect(resolveRecordEventSubjectKinds({
      subjectKind: 'base_roles',
      subjectKinds: 'base_users',
    })).toBe('empty');
  });

  it('returns empty for the no-match sentinel', () => {
    expect(resolveRecordEventSubjectKinds({
      subjectKinds: RECORD_EVENT_NO_MATCH_KIND,
    })).toBe('empty');
  });
});

describe('record event filter catalogs', () => {
  it('maps Users / Profile / Auth APIs onto base_users', () => {
    const filters = listRecordEventPlatformApiFilters();
    expect(filters.find((item) => item.value === 'platform-users')?.subjectKinds).toEqual(['base_users']);
    expect(filters.find((item) => item.value === 'platform-profile')?.subjectKinds).toEqual(['base_users']);
    expect(filters.find((item) => item.value === 'platform-auth')?.subjectKinds).toEqual(['base_users']);
    expect(filters.find((item) => item.value === 'platform-roles')?.subjectKinds).toEqual(['base_roles']);
    expect(filters.find((item) => item.value === 'platform-sample-mock')?.subjectKinds).toEqual([
      'base_sample_mock_records',
    ]);
  });

  it('maps Data API definitions to the model objectName', () => {
    const filters = listRecordEventDataApiFilters(
      [{ key: 'orders', label: 'Orders', edgeModelId: 'm1' }],
      [{ id: 'm1', objectName: 'Orders' }],
    );
    expect(filters).toEqual([{
      value: toDataApiFilterValue('orders'),
      label: 'Orders (Data API)',
      subjectKinds: ['Orders'],
    }]);
  });

  it('keeps known entity labels ahead of extra Data Studio names', () => {
    const options = mergeRecordEventEntityOptions({
      models: [{ objectName: 'Orders', title: 'Orders' }],
      extraValues: ['base_users', RECORD_EVENT_FILTER_ALL],
    });
    expect(options.find((item) => item.value === 'base_users')?.label).toBe('Users');
    expect(options.some((item) => item.value === 'Orders')).toBe(true);
  });

  it('builds list params from entity and API', () => {
    expect(toRecordEventListKindParams({
      entity: 'base_users',
      api: RECORD_EVENT_FILTER_ALL,
    })).toEqual({ subjectKind: 'base_users' });
    expect(toRecordEventListKindParams({
      entity: RECORD_EVENT_FILTER_ALL,
      api: 'platform-users',
    })).toEqual({ subjectKinds: 'base_users' });
    expect(toRecordEventListKindParams({
      entity: RECORD_EVENT_FILTER_ALL,
      api: toDataApiFilterValue('gone'),
    })).toEqual({ subjectKinds: RECORD_EVENT_NO_MATCH_KIND });
    expect(subjectKindsForRecordEventApiFilter('platform-sample-mock')).toEqual([
      'base_sample_mock_records',
    ]);
  });

  it('resolves typed values that are not in the model catalog', () => {
    expect(commitRecordEventFilterValue('Users', [{ value: 'base_users', label: 'Users' }])).toBe('base_users');
    expect(commitRecordEventFilterValue('cms_posts', [{ value: 'base_users', label: 'Users' }])).toBe('cms_posts');
    expect(subjectKindsForRecordEventApiFilter('platform-workflows')?.some((kind) => (
      kind.startsWith('base_workflow')
    ))).toBe(true);
    expect(subjectKindsForRecordEventApiFilter('cms_posts')).toEqual(['cms_posts']);
  });
});
