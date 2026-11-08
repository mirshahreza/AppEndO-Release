import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { isDatabaseReachable, bootstrapWorkflowE2eEnvironment, shutdownWorkflowE2eEnvironment } from '../../../test/workflowE2eTestHarness';
import { createSavedFilter, listSavedFiltersForOwner, deleteOwnSavedFilter } from '../workItemSavedFilterRepository';

const dbReady = await isDatabaseReachable();
const OWNER_USER_ID = 515253;
const OTHER_USER_ID = 545556;

describe.skipIf(!dbReady)('WorkItemSavedFilter repository (HWF-4.3, real DB)', () => {
  let pool: Awaited<ReturnType<typeof bootstrapWorkflowE2eEnvironment>>['pool'];

  beforeAll(async () => {
    ({ pool } = await bootstrapWorkflowE2eEnvironment());
  });

  afterAll(async () => {
    await shutdownWorkflowE2eEnvironment(pool);
  });

  it('creates and lists a saved filter for its owner, newest first', async () => {
    await createSavedFilter({ userId: OWNER_USER_ID, name: 'My urgent', filterJson: JSON.stringify({ priorityFilter: 'HIGH' }) });
    await createSavedFilter({ userId: OWNER_USER_ID, name: 'Overdue', filterJson: JSON.stringify({ overdueOnly: true }) });

    const filters = await listSavedFiltersForOwner(OWNER_USER_ID);
    expect(filters.length).toBeGreaterThanOrEqual(2);
    expect(filters[0].name).toBe('Overdue');
    expect(JSON.parse(filters[0].filterJson)).toEqual({ overdueOnly: true });
  });

  it('does not let another user delete someone else\'s saved filter', async () => {
    const created = await createSavedFilter({ userId: OWNER_USER_ID, name: 'Protected', filterJson: '{}' });
    const deletedByOther = await deleteOwnSavedFilter(created.id, OTHER_USER_ID);
    expect(deletedByOther).toBe(false);

    const deletedByOwner = await deleteOwnSavedFilter(created.id, OWNER_USER_ID);
    expect(deletedByOwner).toBe(true);
  });
});
