import { describe, expect, it } from 'vitest';
import {
  VOTING_BASE_INFO_CATEGORIES,
  VOTING_BASE_INFO_ROOT_TITLE,
} from '../votingBaseInfoCatalog';

describe('votingBaseInfoCatalog', () => {
  it('defines Voting root and categories', () => {
    expect(VOTING_BASE_INFO_ROOT_TITLE).toBe('Voting');
    expect(VOTING_BASE_INFO_CATEGORIES.length).toBeGreaterThanOrEqual(4);
    const statusCategory = VOTING_BASE_INFO_CATEGORIES.find((c) => c.title === 'Voting statuses');
    expect(statusCategory?.items.some((i) => i.shortName === 'open')).toBe(true);
  });
});
