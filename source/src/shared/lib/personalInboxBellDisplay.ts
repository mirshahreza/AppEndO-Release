import type { PersonalInboxItem } from '../api/contracts/personal-inbox/types';

/** Test / seed titles like `inbox-alert-1793438561480-9c4n2f` — prefer human summary in bell UI. */
export function looksLikeAutoInboxTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) {
    return false;
  }
  if (/^inbox-(?:alert|wi|work|feedback|work_item|message)[-_]/i.test(trimmed)) {
    return true;
  }
  if (/^inbox-[a-z_]+-\d+/i.test(trimmed)) {
    return true;
  }
  return trimmed.length >= 28 && !/\s/.test(trimmed);
}

export function resolvePersonalInboxBellPrimaryLine(item: PersonalInboxItem): string {
  const title = item.title?.trim() ?? '';
  const summary = item.summary?.trim() ?? '';
  const originDetail = item.originDetail?.trim() ?? '';
  if (summary && looksLikeAutoInboxTitle(title)) {
    return summary;
  }
  if (looksLikeAutoInboxTitle(title) && originDetail) {
    return originDetail;
  }
  return title || summary || originDetail || '—';
}

export function resolvePersonalInboxBellSecondaryLine(item: PersonalInboxItem): string | null {
  const title = item.title?.trim() ?? '';
  const summary = item.summary?.trim() ?? '';
  const primary = resolvePersonalInboxBellPrimaryLine(item);
  if (summary && looksLikeAutoInboxTitle(title) && summary === primary) {
    return item.originDetail?.trim() || null;
  }
  if (summary && summary !== primary) {
    return summary;
  }
  return item.originDetail?.trim() || null;
}
