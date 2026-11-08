import { describe, expect, it } from 'vitest';

import { normalizeDataApiWritePayload } from '../dataApiExecutor';
import { unwrapDataApiWriteRequestBody } from '../dataApiRequestBody';
import type { EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';

describe('unwrapDataApiWriteRequestBody', () => {
  it('merges nested body with flat top-level fields', () => {
    expect(unwrapDataApiWriteRequestBody({
      body: { titleAr: 'Nested' },
      titleAr: 'Top',
      params: { pk: '1' },
    })).toEqual({ titleAr: 'Top' });
  });

  it('uses flat client JSON when body envelope is absent', () => {
    expect(unwrapDataApiWriteRequestBody({
      titleAr: 'Flat',
      isActive: true,
    })).toEqual({ titleAr: 'Flat', isActive: true });
  });
});

describe('normalizeDataApiWritePayload envelope', () => {
  const model = {
    objectName: 'hwy_institutes',
    primaryKey: 'id',
    columns: [
      { field: 'titleAr', name: 'title_ar', sequelizeType: 'STRING', dataType: 'NVARCHAR', allowNull: true, isPrimaryKey: false, isForeignKey: false },
      { field: 'inviteExpiresAfterDays', name: 'invite_expires_after_days', sequelizeType: 'INTEGER', dataType: 'INT', allowNull: true, isPrimaryKey: false, isForeignKey: false },
    ],
  } as EdgeModelDefinition;

  it('normalizes flat managed-function proxy bodies', () => {
    const payload = normalizeDataApiWritePayload(model, {
      params: { pk: '3' },
      body: { titleAr: 'Updated', inviteExpiresAfterDays: '7' },
      titleAr: 'Updated',
      inviteExpiresAfterDays: '7',
    });
    expect(payload.titleAr).toBe('Updated');
    expect(payload.inviteExpiresAfterDays).toBe(7);
  });
});
