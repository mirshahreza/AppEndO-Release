import type { PersonalInboxKindFilter, PersonalInboxViewFilter } from '../../../shared/api/contracts/personal-inbox/types';
import { parsePersonalInboxFolderFilterToken } from '../../../shared/personal-inbox/personalInboxFolderRefs';
import type {
  PersonalInboxAttentionFilter,
  PersonalInboxCorrespondenceFilter,
  PersonalInboxFeedbackScopeFilter,
} from '../../../shared/lib/personalInboxKindFieldFilters';

export const PERSONAL_INBOX_NOTIFICATION_ID_PARAM = 'notificationId';
export const PERSONAL_INBOX_DISPATCH_ID_PARAM = 'dispatchId';
export const PERSONAL_INBOX_ATTENTION_PARAM = 'attention';
export const PERSONAL_INBOX_CORRESPONDENCE_PARAM = 'correspondence';
export const PERSONAL_INBOX_WORK_ITEM_TYPE_PARAM = 'workItemType';
export const PERSONAL_INBOX_FEEDBACK_SCOPE_PARAM = 'feedbackScope';
export const PERSONAL_INBOX_ALERT_SOURCE_PARAM = 'alertSource';
export const PERSONAL_INBOX_DISPATCH_CHANNEL_PARAM = 'dispatchChannel';
export const PERSONAL_INBOX_DISPATCH_STATUS_PARAM = 'dispatchStatus';

export type PersonalInboxListUiFilters = {
  attention: PersonalInboxAttentionFilter;
  correspondence: PersonalInboxCorrespondenceFilter;
  workItemType: string;
  feedbackScope: PersonalInboxFeedbackScopeFilter;
  alertSource: string;
  dispatchChannel: string;
  dispatchStatus: string;
};

const setOptionalQueryParam = (params: URLSearchParams, key: string, value: string): void => {
  const trimmed = value.trim();
  if (!trimmed) {
    params.delete(key);
  } else {
    params.set(key, trimmed);
  }
};

export function parsePersonalInboxListUiFilters(params: URLSearchParams): PersonalInboxListUiFilters {
  const attentionRaw = params.get(PERSONAL_INBOX_ATTENTION_PARAM)?.trim().toLowerCase();
  const attention: PersonalInboxAttentionFilter = attentionRaw === 'unread' || attentionRaw === 'read'
    ? attentionRaw
    : '';

  const correspondenceRaw = params.get(PERSONAL_INBOX_CORRESPONDENCE_PARAM)?.trim().toLowerCase();
  const correspondence: PersonalInboxCorrespondenceFilter = correspondenceRaw === 'replied' || correspondenceRaw === 'forwarded'
    ? correspondenceRaw
    : '';

  const feedbackScopeRaw = params.get(PERSONAL_INBOX_FEEDBACK_SCOPE_PARAM)?.trim();
  const feedbackScope: PersonalInboxFeedbackScopeFilter = (
    feedbackScopeRaw === 'my_submission'
    || feedbackScopeRaw === 'assigned_to_me'
    || feedbackScopeRaw === 'role'
  )
    ? feedbackScopeRaw
    : '';

  return {
    attention,
    correspondence,
    workItemType: params.get(PERSONAL_INBOX_WORK_ITEM_TYPE_PARAM)?.trim() ?? '',
    feedbackScope,
    alertSource: params.get(PERSONAL_INBOX_ALERT_SOURCE_PARAM)?.trim() ?? '',
    dispatchChannel: params.get(PERSONAL_INBOX_DISPATCH_CHANNEL_PARAM)?.trim() ?? '',
    dispatchStatus: params.get(PERSONAL_INBOX_DISPATCH_STATUS_PARAM)?.trim() ?? '',
  };
}

export function applyPersonalInboxListUiFilters(
  params: URLSearchParams,
  filters: PersonalInboxListUiFilters,
): URLSearchParams {
  const next = new URLSearchParams(params);
  setOptionalQueryParam(next, PERSONAL_INBOX_ATTENTION_PARAM, filters.attention);
  setOptionalQueryParam(next, PERSONAL_INBOX_CORRESPONDENCE_PARAM, filters.correspondence);
  setOptionalQueryParam(next, PERSONAL_INBOX_WORK_ITEM_TYPE_PARAM, filters.workItemType);
  setOptionalQueryParam(next, PERSONAL_INBOX_FEEDBACK_SCOPE_PARAM, filters.feedbackScope);
  setOptionalQueryParam(next, PERSONAL_INBOX_ALERT_SOURCE_PARAM, filters.alertSource);
  setOptionalQueryParam(next, PERSONAL_INBOX_DISPATCH_CHANNEL_PARAM, filters.dispatchChannel);
  setOptionalQueryParam(next, PERSONAL_INBOX_DISPATCH_STATUS_PARAM, filters.dispatchStatus);
  return next;
}

export function clearPersonalInboxListUiFilterParams(params: URLSearchParams): URLSearchParams {
  return applyPersonalInboxListUiFilters(params, {
    attention: '',
    correspondence: '',
    workItemType: '',
    feedbackScope: '',
    alertSource: '',
    dispatchChannel: '',
    dispatchStatus: '',
  });
}

export function parsePersonalInboxViewFilter(params: URLSearchParams): PersonalInboxViewFilter {
  const raw = params.get('view')?.trim().toLowerCase();
  if (raw === 'archived') {
    return 'archived';
  }
  if (raw === 'all') {
    return 'all';
  }
  return 'active';
}

/** Folder filter token for API (`folder` query param). Empty string = inbox. */
export function parsePersonalInboxFolderFilter(params: URLSearchParams): string {
  const folder = params.get('folder')?.trim();
  if (folder) {
    return folder;
  }
  const view = parsePersonalInboxViewFilter(params);
  if (view === 'archived') {
    return 'archived';
  }
  if (view === 'all') {
    return 'all';
  }
  return '';
}

export function applyPersonalInboxKindFilter(
  params: URLSearchParams,
  kind: PersonalInboxKindFilter,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (kind === 'all') {
    next.delete('kind');
  } else {
    next.set('kind', kind);
  }
  if (kind !== 'message_dispatch') {
    next.delete(PERSONAL_INBOX_DISPATCH_ID_PARAM);
    next.delete(PERSONAL_INBOX_DISPATCH_CHANNEL_PARAM);
    next.delete(PERSONAL_INBOX_DISPATCH_STATUS_PARAM);
  }
  if (kind !== 'work_item') {
    next.delete('workItemId');
    next.delete(PERSONAL_INBOX_WORK_ITEM_TYPE_PARAM);
  }
  if (kind !== 'feedback') {
    next.delete(PERSONAL_INBOX_FEEDBACK_SCOPE_PARAM);
  }
  if (kind !== 'alert') {
    next.delete(PERSONAL_INBOX_NOTIFICATION_ID_PARAM);
    next.delete(PERSONAL_INBOX_ALERT_SOURCE_PARAM);
  }
  return next;
}

export function applyPersonalInboxWorkItemOpen(
  params: URLSearchParams,
  workItemId: number | null,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (workItemId == null || workItemId <= 0) {
    next.delete('workItemId');
  } else {
    next.set('workItemId', String(workItemId));
  }
  return next;
}

export function parsePersonalInboxWorkItemId(params: URLSearchParams): number | null {
  const raw = params.get('workItemId')?.trim();
  if (!raw) {
    return null;
  }
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function parsePersonalInboxNotificationId(params: URLSearchParams): number | null {
  const raw = params.get(PERSONAL_INBOX_NOTIFICATION_ID_PARAM)?.trim();
  if (!raw) {
    return null;
  }
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function parsePersonalInboxDispatchId(params: URLSearchParams): number | null {
  const raw = params.get(PERSONAL_INBOX_DISPATCH_ID_PARAM)?.trim();
  if (!raw) {
    return null;
  }
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function buildPersonalInboxAlertFocusHref(notificationId: number): string {
  const params = new URLSearchParams();
  params.set('kind', 'alert');
  params.set(PERSONAL_INBOX_NOTIFICATION_ID_PARAM, String(notificationId));
  return `my-inbox?${params.toString()}`;
}

export function buildPersonalInboxDispatchFocusHref(dispatchId: number): string {
  const params = new URLSearchParams();
  params.set('kind', 'message_dispatch');
  params.set(PERSONAL_INBOX_DISPATCH_ID_PARAM, String(dispatchId));
  return `my-inbox?${params.toString()}`;
}

export function clearPersonalInboxAlertFocusParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(PERSONAL_INBOX_NOTIFICATION_ID_PARAM);
  return next;
}

export function clearPersonalInboxDispatchFocusParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(PERSONAL_INBOX_DISPATCH_ID_PARAM);
  return next;
}

export function applyPersonalInboxFolderFilter(
  params: URLSearchParams,
  folderToken: string,
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete('view');
  const trimmed = folderToken.trim();
  if (!trimmed) {
    next.delete('folder');
    return next;
  }
  const parsed = parsePersonalInboxFolderFilterToken(trimmed);
  if (parsed.scope === 'system' && parsed.slug === 'inbox') {
    next.delete('folder');
  } else {
    next.set('folder', trimmed);
  }
  return next;
}

/** @deprecated Use applyPersonalInboxFolderFilter */
export function applyPersonalInboxViewFilter(
  params: URLSearchParams,
  view: PersonalInboxViewFilter,
): URLSearchParams {
  if (view === 'archived') {
    return applyPersonalInboxFolderFilter(params, 'archived');
  }
  if (view === 'all') {
    return applyPersonalInboxFolderFilter(params, 'all');
  }
  return applyPersonalInboxFolderFilter(params, '');
}
