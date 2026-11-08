import { describe, expect, it } from 'vitest';
import {
  deriveRefineScopePaths,
  isComplexSearchQuery,
  mergeSearchMatchLists,
  refineSearchQueryFromMatches,
} from '../searchCodebaseSubLoop';

describe('searchCodebaseSubLoop', () => {
  it('detects complex multi-word queries', () => {
    expect(isComplexSearchQuery('AppTableGrid')).toBe(false);
    expect(isComplexSearchQuery('find validation helpers for users list and grid columns')).toBe(true);
  });

  it('refines query with hints from top matches', () => {
    const refined = refineSearchQueryFromMatches('validation helpers', [
      { path: 'src/features/users/UsersPage.tsx', line: 10, column: 1, pageKey: 'users' },
    ]);
    expect(refined).toContain('UsersPage');
  });

  it('merges search matches without duplicates', () => {
    const merged = mergeSearchMatchLists(
      [{ path: 'src/a.ts', line: 1, column: 1 }],
      [{ path: 'src/a.ts', line: 1, column: 1 }, { path: 'src/b.ts', line: 2, column: 1 }],
      10,
    );
    expect(merged).toHaveLength(2);
  });

  it('derives parent scope paths for refine pass', () => {
    expect(deriveRefineScopePaths([
      { path: 'src/features/users/UsersPage.tsx', line: 4, column: 1 },
    ])).toEqual(['src/features/users']);
  });
});
