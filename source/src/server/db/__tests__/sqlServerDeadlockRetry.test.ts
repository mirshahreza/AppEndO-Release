import { describe, expect, it, vi } from 'vitest';

import { isSqlServerDeadlockError, withSqlServerDeadlockRetry } from '../sqlServerDeadlockRetry';

describe('sqlServerDeadlockRetry', () => {
  it('detects SQL Server deadlock messages', () => {
    expect(
      isSqlServerDeadlockError(
        new Error(
          'Transaction (Process ID 57) was deadlocked on lock resources with another process and has been chosen as the deadlock victim.',
        ),
      ),
    ).toBe(true);
    expect(isSqlServerDeadlockError({ parent: { number: 1205 } })).toBe(true);
    expect(isSqlServerDeadlockError(new Error('Connection timeout'))).toBe(false);
  });

  it('retries on deadlock then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          'Transaction was deadlocked on lock resources with another process and has been chosen as the deadlock victim.',
        ),
      )
      .mockResolvedValueOnce('ok');

    await expect(withSqlServerDeadlockRetry(fn, { baseDelayMs: 0 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
