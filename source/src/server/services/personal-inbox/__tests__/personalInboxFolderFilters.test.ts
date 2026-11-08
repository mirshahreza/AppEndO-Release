import { describe, expect, it } from 'vitest';
import { filterPersonalInboxItemsByFolderScope } from '../personalInboxFolderFilters';
import {
  PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED,
  PERSONAL_INBOX_SYSTEM_FOLDER_DELETED,
  PERSONAL_INBOX_SYSTEM_FOLDER_PURGED,
} from '../../../../shared/personal-inbox/personalInboxFolderRefs';

describe('personalInboxFolderFilters', () => {
  const tagIndex = new Map<string, Set<string>>([
    ['a:1', new Set([PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED])],
    ['a:2', new Set([PERSONAL_INBOX_SYSTEM_FOLDER_DELETED])],
    ['a:3', new Set(['user:9'])],
  ]);

  it('inbox excludes archived and deleted tags', () => {
    const items = [{ id: 'a:1' }, { id: 'a:2' }, { id: 'a:3' }];
    const result = filterPersonalInboxItemsByFolderScope(items, tagIndex, { scope: 'system', slug: 'inbox' });
    expect(result.map((row) => row.id)).toEqual(['a:3']);
  });

  it('excludes purged items from every folder view', () => {
    const purgedIndex = new Map<string, Set<string>>([
      ['a:9', new Set([PERSONAL_INBOX_SYSTEM_FOLDER_PURGED])],
      ['a:2', new Set([PERSONAL_INBOX_SYSTEM_FOLDER_DELETED])],
    ]);
    const items = [{ id: 'a:9' }, { id: 'a:2' }];
    expect(
      filterPersonalInboxItemsByFolderScope(items, purgedIndex, { scope: 'system', slug: 'deleted' }).map((r) => r.id),
    ).toEqual(['a:2']);
    expect(
      filterPersonalInboxItemsByFolderScope(items, purgedIndex, { scope: 'system', slug: 'all' }).map((r) => r.id),
    ).toEqual(['a:2']);
  });

  it('user folder filter matches tagged items', () => {
    const items = [{ id: 'a:1' }, { id: 'a:3' }];
    const result = filterPersonalInboxItemsByFolderScope(items, tagIndex, { scope: 'user', folderId: 9 });
    expect(result.map((row) => row.id)).toEqual(['a:3']);
  });
});
