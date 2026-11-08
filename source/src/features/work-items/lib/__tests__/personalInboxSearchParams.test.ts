import { describe, expect, it } from 'vitest';
import {
  applyPersonalInboxKindFilter,
  applyPersonalInboxListUiFilters,
  applyPersonalInboxViewFilter,
  parsePersonalInboxFolderFilter,
  parsePersonalInboxListUiFilters,
  parsePersonalInboxViewFilter,
} from '../personalInboxSearchParams';

describe('applyPersonalInboxKindFilter', () => {
  it('clears kind for all and keeps archived folder', () => {
    const next = applyPersonalInboxKindFilter(
      new URLSearchParams('kind=alert&folder=archived'),
      'all',
    );
    expect(next.get('kind')).toBeNull();
    expect(next.get('folder')).toBe('archived');
  });

  it('sets kind and drops dispatchId when leaving send log', () => {
    const next = applyPersonalInboxKindFilter(
      new URLSearchParams('kind=message_dispatch&dispatchId=9'),
      'feedback',
    );
    expect(next.get('kind')).toBe('feedback');
    expect(next.get('dispatchId')).toBeNull();
  });

  it('keeps dispatchId when kind is message_dispatch', () => {
    const next = applyPersonalInboxKindFilter(
      new URLSearchParams('dispatchId=9'),
      'message_dispatch',
    );
    expect(next.get('kind')).toBe('message_dispatch');
    expect(next.get('dispatchId')).toBe('9');
  });
});

describe('applyPersonalInboxViewFilter', () => {
  it('maps view to folder query params', () => {
    const archived = applyPersonalInboxViewFilter(new URLSearchParams('kind=alert'), 'archived');
    expect(archived.get('folder')).toBe('archived');
    expect(archived.get('kind')).toBe('alert');

    const active = applyPersonalInboxViewFilter(archived, 'active');
    expect(active.get('folder')).toBeNull();

    const all = applyPersonalInboxViewFilter(new URLSearchParams(), 'all');
    expect(all.get('folder')).toBe('all');
  });
});

describe('parsePersonalInboxViewFilter', () => {
  it('defaults to active', () => {
    expect(parsePersonalInboxViewFilter(new URLSearchParams())).toBe('active');
    expect(parsePersonalInboxViewFilter(new URLSearchParams('view=archived'))).toBe('archived');
    expect(parsePersonalInboxViewFilter(new URLSearchParams('view=all'))).toBe('all');
  });
});

describe('parsePersonalInboxFolderFilter', () => {
  it('defaults to inbox when folder is omitted', () => {
    expect(parsePersonalInboxFolderFilter(new URLSearchParams())).toBe('');
    expect(parsePersonalInboxFolderFilter(new URLSearchParams('folder=all'))).toBe('all');
  });
});

describe('parsePersonalInboxListUiFilters', () => {
  it('round-trips list UI filters in the query string', () => {
    const params = applyPersonalInboxListUiFilters(new URLSearchParams(), {
      attention: 'unread',
      correspondence: 'replied',
      workItemType: 'task',
      feedbackScope: 'role',
      alertSource: 'workflow',
      dispatchChannel: 'email',
      dispatchStatus: 'sent',
    });
    expect(parsePersonalInboxListUiFilters(params)).toEqual({
      attention: 'unread',
      correspondence: 'replied',
      workItemType: 'task',
      feedbackScope: 'role',
      alertSource: 'workflow',
      dispatchChannel: 'email',
      dispatchStatus: 'sent',
    });
  });
});
