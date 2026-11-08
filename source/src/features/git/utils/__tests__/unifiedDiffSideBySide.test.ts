import { describe, expect, it } from 'vitest';
import { hasUnifiedDiffChanges, parseUnifiedDiffToSideBySideRows } from '../unifiedDiffSideBySide';

const SAMPLE_DIFF = `diff --git a/foo.ts b/foo.ts
index 1111111..2222222 100644
--- a/foo.ts
+++ b/foo.ts
@@ -1,3 +1,3 @@
 unchanged
-removed line
+added line
 tail`;

describe('parseUnifiedDiffToSideBySideRows', () => {
  it('splits unified diff into before/after rows', () => {
    const rows = parseUnifiedDiffToSideBySideRows(SAMPLE_DIFF);

    expect(rows).toEqual([
      {
        left: '@@ -1,3 +1,3 @@',
        right: '@@ -1,3 +1,3 @@',
        leftKind: 'equal',
        rightKind: 'equal',
      },
      {
        left: 'unchanged',
        right: 'unchanged',
        leftKind: 'equal',
        rightKind: 'equal',
      },
      {
        left: 'removed line',
        right: '',
        leftKind: 'removed',
        rightKind: 'padding',
      },
      {
        left: '',
        right: 'added line',
        leftKind: 'padding',
        rightKind: 'added',
      },
      {
        left: 'tail',
        right: 'tail',
        leftKind: 'equal',
        rightKind: 'equal',
      },
    ]);
  });

  it('detects when a diff has textual changes', () => {
    expect(hasUnifiedDiffChanges(SAMPLE_DIFF)).toBe(true);
    expect(hasUnifiedDiffChanges('')).toBe(false);
  });
});
