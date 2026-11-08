import { describe, expect, it } from 'vitest';
import { summarizeWorkspaceMutationDiff } from '../workspaceDiffScaffold';

describe('workspaceDiffScaffold', () => {
  it('summarizes isolated workspace mutation paths', () => {
    const summary = summarizeWorkspaceMutationDiff([
      'appendoo/ws/cs-1/workspace/server-functions/custom/demo.ts',
      'appendoo/ws/cs-1/workspace/designer/layouts/page.json',
    ]);

    expect(summary.addedCount).toBe(2);
    expect(summary.previewPaths).toHaveLength(2);
    expect(summary.isolatedPrefix).toBe('appendoo/ws/cs-1');
  });
});
