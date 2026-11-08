import { describe, expect, it } from 'vitest';
import type { SettingsAttributeWithValueRow } from '../../../domain/attributes/valueRepository';
import {
  flattenMultiRoleRows,
  mergeIdentityContextEntries,
  mergeProfileContextEntries,
  mergeRecordScopeContextEntries,
  mergeSessionContextEntries,
  splitContextByVisibility,
} from '../sessionContext.service';

const baseRow = (
  overrides: Partial<SettingsAttributeWithValueRow> = {},
): SettingsAttributeWithValueRow => ({
  id: 1,
  key: 'city',
  label: 'City',
  scope: 'USER',
  source_type: 'BASE_INFO',
  base_info_root_id: '103',
  profile_field: null,
  data_type: 'base_info_code',
  cardinality: 'single',
  min_selections: null,
  max_selections: null,
  visibility: 'BOTH',
  is_required: false,
  is_active: true,
  is_builtin: false,
  user_editable: false,
  user_edit_policy: 'NONE' as const,
  view_order: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  created_by: null,
  created_by_username: null,
  updated_at: '2026-01-01T00:00:00.000Z',
  updated_by: null,
  updated_by_username: null,
  value_id: null,
  value_text: null,
  ...overrides,
});

describe('mergeSessionContextEntries', () => {
  it('uses user override over role default for the same key', () => {
    const merged = mergeSessionContextEntries(
      [baseRow({ id: 1, scope: 'USER', key: 'allowed_cities', value_text: '["103.9"]' })],
      [baseRow({
        id: 2,
        scope: 'ROLE',
        key: 'allowed_cities',
        cardinality: 'multi',
        value_text: '["103.5","103.12","103.3"]',
      })],
    );

    expect(merged['user.allowed_cities']?.value).toEqual(['103.9']);
    expect(merged['role.allowed_cities']?.value).toEqual(['103.5', '103.12', '103.3']);
  });

  it('falls back to role default when user value is missing', () => {
    const merged = mergeSessionContextEntries(
      [baseRow({ id: 1, scope: 'USER', key: 'allowed_cities', value_text: null })],
      [baseRow({
        id: 2,
        scope: 'ROLE',
        key: 'allowed_cities',
        cardinality: 'multi',
        value_text: '["103.5","103.12","103.3"]',
      })],
    );

    expect(merged['user.allowed_cities']?.value).toEqual(['103.5', '103.12', '103.3']);
    expect(merged['role.allowed_cities']?.value).toEqual(['103.5', '103.12', '103.3']);
  });

  it('replaces multi arrays completely instead of unioning', () => {
    const merged = mergeSessionContextEntries(
      [baseRow({
        id: 1,
        scope: 'USER',
        key: 'allowed_cities',
        cardinality: 'multi',
        value_text: '["103.9"]',
      })],
      [baseRow({
        id: 2,
        scope: 'ROLE',
        key: 'allowed_cities',
        cardinality: 'multi',
        value_text: '["103.5","103.12","103.3"]',
      })],
    );

    expect(merged['user.allowed_cities']?.value).toEqual(['103.9']);
    expect(merged['user.allowed_cities']?.value).not.toEqual(['103.5', '103.12', '103.3', '103.9']);
  });

  it('prefixes keys with user. and role. namespaces', () => {
    const merged = mergeSessionContextEntries(
      [baseRow({ id: 1, scope: 'USER', key: 'city_code', value_text: '"103.5"' })],
      [baseRow({ id: 2, scope: 'ROLE', key: 'region', value_text: '"north"' })],
    );

    expect(Object.keys(merged)).toEqual(expect.arrayContaining(['user.city_code', 'role.region']));
  });
});

describe('mergeProfileContextEntries', () => {
  it('reads profile field values from base_user_profiles without role fallback', () => {
    const merged = mergeProfileContextEntries(
      [{
        profile_field: 'gender_code',
        context_key: 'gender',
        label_en: null,
        is_active: true,
        user_edit_policy: 'NONE',
        visibility: 'BOTH',
        view_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        created_by: null,
        updated_at: '2026-01-01T00:00:00.000Z',
        updated_by: null,
      }],
      {
        gender_code: '101.2',
        firstname: null,
        lastname: null,
        fathername: null,
        grandfathername: null,
        phone: null,
        nickname: null,
        national_code: null,
        birth_year: null,
        birth_month: null,
        birth_day: null,
        person_type_code: null,
        profile_image: false,
        profile_image_mime: null,
        profile_image_body_xs: null,
      },
    );

    expect(merged['user.gender']).toEqual({ value: '101.2', visibility: 'BOTH' });
    expect(Object.keys(merged)).toEqual(['user.gender']);
  });

  it('omits profile field keys when profile column is null', () => {
    const merged = mergeProfileContextEntries(
      [{
        profile_field: 'gender_code',
        context_key: 'gender',
        label_en: null,
        is_active: true,
        user_edit_policy: 'NONE',
        visibility: 'CLIENT',
        view_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        created_by: null,
        updated_at: '2026-01-01T00:00:00.000Z',
        updated_by: null,
      }],
      {
        gender_code: null,
        firstname: null,
        lastname: null,
        fathername: null,
        grandfathername: null,
        phone: null,
        nickname: null,
        national_code: null,
        birth_year: null,
        birth_month: null,
        birth_day: null,
        person_type_code: null,
        profile_image: false,
        profile_image_mime: null,
        profile_image_body_xs: null,
      },
    );

    expect(merged).toEqual({});
  });
});

describe('flattenMultiRoleRows', () => {
  it('keeps the oldest role assignment when multiple roles share the same key', () => {
    const oldestRoleRows = [
      baseRow({
        id: 2,
        scope: 'ROLE',
        key: 'allowed_cities',
        cardinality: 'multi',
        value_text: '["103.5","103.12"]',
      }),
    ];
    const newerRoleRows = [
      baseRow({
        id: 3,
        scope: 'ROLE',
        key: 'allowed_cities',
        cardinality: 'multi',
        value_text: '["103.9"]',
      }),
      baseRow({
        id: 4,
        scope: 'ROLE',
        key: 'region',
        value_text: '"north"',
      }),
    ];

    const effective = flattenMultiRoleRows([oldestRoleRows, newerRoleRows]);
    const merged = mergeSessionContextEntries(
      [baseRow({ id: 1, scope: 'USER', key: 'allowed_cities', value_text: null })],
      effective,
    );

    expect(effective.map((row) => row.key)).toEqual(['allowed_cities', 'region']);
    expect(merged['user.allowed_cities']?.value).toEqual(['103.5', '103.12']);
    expect(merged['role.region']?.value).toBe('north');
  });
});

describe('mergeRecordScopeContextEntries', () => {
  it('maps dimension snapshots to server-only scope.* keys', () => {
    const merged = mergeRecordScopeContextEntries({
      org: { ids: ['120.1'], mode: 'subtree' },
      geo: { ids: ['121.1'], mode: 'subtree' },
    });
    expect(merged['scope.org']).toEqual({ value: ['120.1'], visibility: 'SERVER' });
    expect(merged['scope.geo']).toEqual({ value: ['121.1'], visibility: 'SERVER' });
  });
});

describe('splitContextByVisibility', () => {
  it('splits SERVER, CLIENT, and BOTH visibility into separate slices', () => {
    const merged = mergeSessionContextEntries(
      [
        baseRow({ id: 1, scope: 'USER', key: 'server_only', visibility: 'SERVER', value_text: '"s"' }),
        baseRow({ id: 2, scope: 'USER', key: 'client_only', visibility: 'CLIENT', value_text: '"c"' }),
        baseRow({ id: 3, scope: 'USER', key: 'both', visibility: 'BOTH', value_text: '"b"' }),
      ],
      [],
    );

    const { serverContext, clientContext } = splitContextByVisibility(merged);

    expect(serverContext).toEqual({
      'user.server_only': 's',
      'user.both': 'b',
    });
    expect(clientContext).toEqual({
      'user.client_only': 'c',
      'user.both': 'b',
    });
  });
});

describe('mergeIdentityContextEntries', () => {
  it('always exposes shell identity keys for account and profile', () => {
    const merged = mergeIdentityContextEntries(
      { id: 7, username: 'ada', email: 'ada@append.test', mobile: null },
      {
        firstname: 'Ada',
        lastname: 'Lovelace',
        company_name: null,
        person_type_code: '102.1',
        profile_image: true,
        has_profile_image_xs: true,
        profile_updated_at: '2026-01-01T00:00:00.000Z',
      },
    );

    expect(merged['user.id']).toEqual({ value: 7, visibility: 'BOTH' });
    expect(merged['user.username']).toEqual({ value: 'ada', visibility: 'BOTH' });
    expect(merged['user.email']).toEqual({ value: 'ada@append.test', visibility: 'BOTH' });
    expect(merged['user.firstname']).toEqual({ value: 'Ada', visibility: 'BOTH' });
    expect(merged['user.profile_image']).toEqual({ value: true, visibility: 'BOTH' });
    expect(merged['user.has_profile_image_xs']).toEqual({ value: true, visibility: 'BOTH' });
  });

  it('always emits shell identity keys even when optional values are null', () => {
    const merged = mergeIdentityContextEntries(
      { id: 3, username: 'bot', email: null, mobile: null },
      {
        firstname: null,
        lastname: null,
        company_name: null,
        person_type_code: null,
        profile_image: false,
        has_profile_image_xs: false,
        profile_updated_at: null,
      },
    );

    expect(merged['user.username']).toEqual({ value: 'bot', visibility: 'BOTH' });
    expect(merged['user.email']).toEqual({ value: null, visibility: 'BOTH' });
    expect(merged['user.firstname']).toEqual({ value: null, visibility: 'BOTH' });
    expect(merged['user.profile_image']).toEqual({ value: false, visibility: 'BOTH' });
  });

  it('does not let optional profile settings re-publish system identity keys', () => {
    const merged = mergeProfileContextEntries(
      [{
        profile_field: 'firstname',
        context_key: 'firstname',
        label_en: null,
        is_active: true,
        user_edit_policy: 'NONE',
        visibility: 'CLIENT',
        view_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        created_by: null,
        updated_at: '2026-01-01T00:00:00.000Z',
        updated_by: null,
      }],
      { firstname: 'ShouldNotAppear' },
    );

    expect(merged['user.firstname']).toBeUndefined();
  });
});
