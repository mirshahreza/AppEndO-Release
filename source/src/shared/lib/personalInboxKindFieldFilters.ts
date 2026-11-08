import type { PersonalInboxItem } from '../api/contracts/personal-inbox/types';

export type PersonalInboxAttentionFilter = '' | 'unread' | 'read';

export type PersonalInboxAttentionToggles = {
  unread: boolean;
  read: boolean;
};

/** Both off or both on = no read-state filter (all items). Exactly one on = that slice. */
export function personalInboxAttentionFilterFromToggles(
  toggles: PersonalInboxAttentionToggles,
): PersonalInboxAttentionFilter {
  if (toggles.unread && !toggles.read) {
    return 'unread';
  }
  if (toggles.read && !toggles.unread) {
    return 'read';
  }
  return '';
}

export function personalInboxAttentionTogglesFromFilter(
  filter: PersonalInboxAttentionFilter,
): PersonalInboxAttentionToggles {
  if (filter === 'unread') {
    return { unread: true, read: false };
  }
  if (filter === 'read') {
    return { unread: false, read: true };
  }
  return { unread: false, read: false };
}

export type PersonalInboxFeedbackScopeFilter = '' | 'my_submission' | 'assigned_to_me' | 'role';

export type PersonalInboxCorrespondenceFilter = '' | 'replied' | 'forwarded';

export function classifyFeedbackOriginDetail(
  detail: string | null | undefined,
): PersonalInboxFeedbackScopeFilter | 'other' {
  const value = detail?.trim() ?? '';
  if (value === 'My submission') {
    return 'my_submission';
  }
  if (value === 'Assigned to me') {
    return 'assigned_to_me';
  }
  if (value.startsWith('Role: ')) {
    return 'role';
  }
  return 'other';
}

export function itemMatchesAttentionFilter(
  item: PersonalInboxItem,
  filter: PersonalInboxAttentionFilter,
): boolean {
  if (!filter) {
    return true;
  }
  const unseen = item.attention === 'action_required' || item.attention === 'unread';
  if (filter === 'unread') {
    return unseen;
  }
  if (filter === 'read') {
    return !unseen;
  }
  return true;
}

export function itemMatchesWorkItemTypeFilter(
  item: PersonalInboxItem,
  workItemType: string,
): boolean {
  if (!workItemType.trim()) {
    return true;
  }
  if (item.kind !== 'work_item') {
    return false;
  }
  return (item.originDetail?.trim() ?? '') === workItemType.trim();
}

export function itemMatchesFeedbackScopeFilter(
  item: PersonalInboxItem,
  scope: PersonalInboxFeedbackScopeFilter,
): boolean {
  if (!scope) {
    return true;
  }
  if (item.kind !== 'feedback') {
    return false;
  }
  return classifyFeedbackOriginDetail(item.originDetail) === scope;
}

export function itemMatchesCorrespondenceFilter(
  item: PersonalInboxItem,
  filter: PersonalInboxCorrespondenceFilter,
): boolean {
  if (!filter) {
    return true;
  }
  if (filter === 'replied') {
    return item.correspondence?.replied === true;
  }
  if (filter === 'forwarded') {
    return item.correspondence?.forwarded === true;
  }
  return true;
}

export function itemMatchesAlertSourceFilter(
  item: PersonalInboxItem,
  source: string,
): boolean {
  if (!source.trim()) {
    return true;
  }
  if (item.kind !== 'alert') {
    return false;
  }
  return (item.originDetail?.trim() ?? '') === source.trim();
}

export function distinctOriginDetails(
  items: PersonalInboxItem[],
  kind: PersonalInboxItem['kind'],
): string[] {
  const values = new Set<string>();
  for (const item of items) {
    if (item.kind !== kind) {
      continue;
    }
    const detail = item.originDetail?.trim();
    if (detail) {
      values.add(detail);
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}
