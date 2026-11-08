import { describe, expect, it } from 'vitest';
import { DEFAULT_LOG_RETENTION } from '../../api/contracts/settings/retention';
import {
  buildRetentionFamilySnapshot,
  formatRetentionBytes,
} from '../retention-control/retentionControlSnapshot';

describe('retentionControlSnapshot', () => {
  it('resolves same-type destination names', () => {
    const snapshot = buildRetentionFamilySnapshot(
      'appLogs',
      {
        ...DEFAULT_LOG_RETENTION.appLogs,
        offload: { mode: 'same-type-db', connectionId: 'conn-1' },
      },
      [{ id: 'conn-1', name: 'Archive DB', type: 'mssql' }],
    );
    expect(snapshot.action).toBe('offload');
    expect(snapshot.destination).toEqual({
      kind: 'same-type-db',
      connectionName: 'Archive DB',
    });
  });

  it('formats byte estimates', () => {
    expect(formatRetentionBytes(0)).toBe('');
    expect(formatRetentionBytes(512)).toBe('512 bytes');
    expect(formatRetentionBytes(2048)).toBe('2.0 KB');
  });
});
