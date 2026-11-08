import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment } from '../../../test/workflowE2eTestHarness';
import { insertOrReturnExistingInbox, claimForCorrelation, transitionInboxStatus } from '../workflowEventInboxRepository';

const dbReady = await isDatabaseReachable();

describe.skipIf(!dbReady)('workflowEventInboxRepository (real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  const uniqueSource = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  it('insert-or-return-existing: two concurrent inserts with the identical dedup key persist exactly one row', async () => {
    const eventSourceIdentity = uniqueSource('src');
    const deduplicationKey = 'invoice-42';
    const results = await Promise.all([
      insertOrReturnExistingInbox({ eventName: 'invoice.paid', eventSourceIdentity, deduplicationKey }),
      insertOrReturnExistingInbox({ eventName: 'invoice.paid', eventSourceIdentity, deduplicationKey }),
    ]);
    const ids = new Set(results.map((r) => r.record.id));
    expect(ids.size).toBe(1);
    expect(results.filter((r) => r.wasCreated)).toHaveLength(1);
  });

  it('rows without a supplied dedup key never collide (sentinel uniqueness, D6) and report deduplicationKey as null', async () => {
    const eventSourceIdentity = uniqueSource('src-no-dedup');
    const first = await insertOrReturnExistingInbox({ eventName: 'invoice.paid', eventSourceIdentity });
    const second = await insertOrReturnExistingInbox({ eventName: 'invoice.paid', eventSourceIdentity });
    expect(first.record.id).not.toBe(second.record.id);
    expect(first.record.deduplicationKey).toBeNull();
    expect(second.record.deduplicationKey).toBeNull();
  });

  it('RECEIVED and non-final UNMATCHED rows are claim-eligible; final recheck expiry blocks further claims', async () => {
    const eventSourceIdentity = uniqueSource('src-claim');
    const { record } = await insertOrReturnExistingInbox({ eventName: 'invoice.paid', eventSourceIdentity, recheckUntilMs: 60_000 });
    const claimed = await claimForCorrelation(record.id, record.stateVersion, 'worker-a', 30_000);
    expect(claimed.leaseOwnerId).toBe('worker-a');

    const unmatched = await transitionInboxStatus(claimed.id, claimed.stateVersion, 'RECHECK_EXHAUSTED');
    expect(unmatched.status).toBe('UNMATCHED');
    const reclaimed = await claimForCorrelation(unmatched.id, unmatched.stateVersion, 'worker-b', 30_000);
    expect(reclaimed.leaseOwnerId).toBe('worker-b');

    const expired = await insertOrReturnExistingInbox({ eventName: 'invoice.paid', eventSourceIdentity: uniqueSource('src-expired'), recheckUntilMs: -1 });
    const expiredUnmatched = await transitionInboxStatus(expired.record.id, expired.record.stateVersion, 'RECHECK_EXHAUSTED');
    await expect(claimForCorrelation(expiredUnmatched.id, expiredUnmatched.stateVersion, 'worker-c', 30_000)).rejects.toThrow();
  });
});
