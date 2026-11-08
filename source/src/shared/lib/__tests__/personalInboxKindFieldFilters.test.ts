import { describe, expect, it } from 'vitest';
import type { PersonalInboxItem } from '../../api/contracts/personal-inbox/types';
import {
  classifyFeedbackOriginDetail,
  itemMatchesAttentionFilter,
  itemMatchesCorrespondenceFilter,
  itemMatchesFeedbackScopeFilter,
  itemMatchesWorkItemTypeFilter,
  personalInboxAttentionFilterFromToggles,
} from '../personalInboxKindFieldFilters';

const feedbackItem = (originDetail: string): PersonalInboxItem => ({
  id: 'feedback:1',
  kind: 'feedback',
  origin: 'Feedback',
  originDetail,
  title: 't',
  summary: null,
  surfacedAt: '2026-01-01T00:00:00.000Z',
  attention: 'unread',
  href: 'my-inbox',
  ref: { type: 'feedback', id: 1 },
});

describe('personalInboxKindFieldFilters', () => {
  it('classifies feedback origin detail tokens', () => {
    expect(classifyFeedbackOriginDetail('My submission')).toBe('my_submission');
    expect(classifyFeedbackOriginDetail('Assigned to me')).toBe('assigned_to_me');
    expect(classifyFeedbackOriginDetail('Role: Admin')).toBe('role');
    expect(classifyFeedbackOriginDetail('Feedback')).toBe('other');
  });

  it('filters feedback by scope', () => {
    const item = feedbackItem('My submission');
    expect(itemMatchesFeedbackScopeFilter(item, 'my_submission')).toBe(true);
    expect(itemMatchesFeedbackScopeFilter(item, 'assigned_to_me')).toBe(false);
  });

  it('maps attention toggles to list filter', () => {
    expect(personalInboxAttentionFilterFromToggles({ unread: false, read: false })).toBe('');
    expect(personalInboxAttentionFilterFromToggles({ unread: true, read: true })).toBe('');
    expect(personalInboxAttentionFilterFromToggles({ unread: true, read: false })).toBe('unread');
    expect(personalInboxAttentionFilterFromToggles({ unread: false, read: true })).toBe('read');
  });

  it('filters by read state', () => {
    const unread = { ...feedbackItem('x'), attention: 'unread' as const };
    const read = { ...feedbackItem('y'), attention: 'none' as const };
    expect(itemMatchesAttentionFilter(unread, 'unread')).toBe(true);
    expect(itemMatchesAttentionFilter(unread, 'read')).toBe(false);
    expect(itemMatchesAttentionFilter(read, 'read')).toBe(true);
    expect(itemMatchesAttentionFilter(read, 'unread')).toBe(false);
  });

  it('filters by correspondence markers', () => {
    const replied: PersonalInboxItem = {
      ...feedbackItem('My submission'),
      correspondence: { replied: true, forwarded: false },
    };
    const forwarded: PersonalInboxItem = {
      ...feedbackItem('My submission'),
      id: 'feedback:2',
      correspondence: { replied: false, forwarded: true },
    };
    expect(itemMatchesCorrespondenceFilter(replied, 'replied')).toBe(true);
    expect(itemMatchesCorrespondenceFilter(replied, 'forwarded')).toBe(false);
    expect(itemMatchesCorrespondenceFilter(forwarded, 'forwarded')).toBe(true);
    expect(itemMatchesCorrespondenceFilter(feedbackItem('x'), '')).toBe(true);
    expect(itemMatchesCorrespondenceFilter(feedbackItem('x'), 'replied')).toBe(false);
  });

  it('filters work items by type token', () => {
    const item: PersonalInboxItem = {
      ...feedbackItem('x'),
      id: 'work_item:2',
      kind: 'work_item',
      originDetail: 'APPROVAL',
      ref: { type: 'work_item', id: 2 },
    };
    expect(itemMatchesWorkItemTypeFilter(item, 'APPROVAL')).toBe(true);
    expect(itemMatchesWorkItemTypeFilter(item, 'TASK')).toBe(false);
  });
});
