import { describe, expect, it } from 'vitest';
import { applyDataApiAuditFields } from '../dataApiAuditFields';

const AUDIT_FIELDS = [
  'createdBy',
  'createdAt',
  'updatedBy',
  'updatedAt',
  'statusCodeUpdatedBy',
  'statusCodeUpdatedAt',
] as const;

describe('dataApiAuditFields', () => {
  it('stamps create audit fields from the authenticated actor', () => {
    expect(applyDataApiAuditFields(
      { title: 'Draft', statusCode: 'draft' },
      AUDIT_FIELDS,
      'create',
      42,
      '2026-08-06T16:00:00.000Z',
    )).toMatchObject({
      createdBy: 42,
      createdAt: '2026-08-06T16:00:00.000Z',
      updatedBy: 42,
      updatedAt: '2026-08-06T16:00:00.000Z',
      statusCodeUpdatedBy: 42,
      statusCodeUpdatedAt: '2026-08-06T16:00:00.000Z',
    });
  });

  it('overrides client-supplied update actors with the authenticated actor', () => {
    expect(applyDataApiAuditFields(
      { title: 'Updated', updatedBy: 999 },
      AUDIT_FIELDS,
      'update',
      7,
      '2026-08-06T17:00:00.000Z',
    )).toMatchObject({
      updatedBy: 7,
      updatedAt: '2026-08-06T17:00:00.000Z',
    });
  });

  it('skips audit stamps when actor is missing or non-positive (Number(null)===0)', () => {
    const payload = { title: 'Draft', statusCode: 'draft' };
    expect(applyDataApiAuditFields(payload, AUDIT_FIELDS, 'update', null)).toEqual(payload);
    expect(applyDataApiAuditFields(payload, AUDIT_FIELDS, 'update', undefined)).toEqual(payload);
    expect(applyDataApiAuditFields(payload, AUDIT_FIELDS, 'update', 0)).toEqual(payload);
  });
});
