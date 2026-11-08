import { describe, expect, it } from 'vitest';
import { buildSuggestedRepackDescription } from '../buildSuggestedRepackDescription';

describe('buildSuggestedRepackDescription', () => {
  it('summarizes changes, additions, and removals', () => {
    const text = buildSuggestedRepackDescription({
      version: '1.0.1',
      changedItems: [{
        itemId: 'api:demo',
        category: 'apis',
        label: 'GET /api/demo',
        entryPath: 'api/demo.ts',
      }],
      addedApiLabels: ['POST /api/reports (Reports)'],
      addedComponentLabels: ['Summary card'],
      addedPortalLabels: ['analytics'],
      addedNavigationLabels: ['main-nav'],
      addedWorkflowLabels: ['global/order-approval'],
      hasInstallSql: true,
      removedApiLabels: ['GET /api/legacy'],
      removedComponentLabels: ['Old widget'],
      removedPortalLabels: [],
      removedNavigationLabels: [],
      removedWorkflowLabels: ['global/old-flow'],
    });

    expect(text).toContain('Changed since v1.0.1');
    expect(text).toContain('GET /api/demo');
    expect(text).toContain('Added:');
    expect(text).toContain('API: POST /api/reports (Reports)');
    expect(text).toContain('Workflow: global/order-approval');
    expect(text).toContain('Database install SQL script');
    expect(text).toContain('Removed:');
    expect(text).toContain('API: GET /api/legacy');
    expect(text).toContain('Workflow: global/old-flow');
  });
});
