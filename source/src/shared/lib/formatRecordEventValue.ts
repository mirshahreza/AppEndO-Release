import { catalogLabelForReasonCode } from '../api/contracts/record-events/changeReasonVocab';

export const formatRecordEventValue = (value: unknown): string => {
  if (value == null) return '—';
  if (typeof value === 'object' && value && 'redacted' in (value as Record<string, unknown>)) {
    return '••••';
  }
  if (typeof value === 'object' && value && 'label' in (value as Record<string, unknown>)) {
    const row = value as { id?: unknown; label?: unknown };
    return String(row.label ?? row.id ?? '');
  }
  if (typeof value === 'object' && value && 'value' in (value as Record<string, unknown>)) {
    return String((value as { value: unknown }).value ?? '');
  }
  return String(value);
};

export const canRestoreRecordEvent = (item: {
  eventKind: string;
  projection?: string;
  fromValue: unknown;
  field: string | null;
}): boolean => {
  if (item.eventKind !== 'field.changed' || item.projection === 'auth' || !item.fromValue) {
    return false;
  }
  if (typeof item.fromValue === 'object' && 'redacted' in (item.fromValue as Record<string, unknown>)) {
    return false;
  }
  return item.field !== 'username' && item.field !== 'mobile';
};

/** Local `yyyy-mm-dd hh:mm` for History grid Time column. */
export const formatRecordEventOccurredAt = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

export type RecordEventStackedLabel = {
  title: string;
  subtitle: string | null;
};

const kindLabel = (kind: string | null | undefined): string => {
  if (kind === 'workflow') return 'Workflow';
  if (kind === 'agent') return 'Agent';
  if (kind === 'system') return 'System';
  if (kind === 'impersonation') return 'Impersonation';
  return 'User';
};

const identityLine = (input: {
  displayName?: string | null;
  username?: string | null;
  userId?: number | null;
}): RecordEventStackedLabel => {
  const name = input.displayName?.trim() || null;
  const username = input.username?.trim() || null;
  const id = input.userId != null ? `#${input.userId}` : null;
  const identitySub = [username, id].filter(Boolean).join(' · ') || null;
  if (name) {
    return { title: name, subtitle: identitySub && identitySub !== name ? identitySub : null };
  }
  if (username) {
    return { title: username, subtitle: id };
  }
  if (id) {
    return { title: id, subtitle: null };
  }
  return { title: '—', subtitle: null };
};

export const recordEventActorStackedLabel = (item: {
  actorKind?: string | null;
  actorUserId?: number | null;
  actingAsUserId?: number | null;
  actorUsername?: string | null;
  actorDisplayName?: string | null;
  actingAsUsername?: string | null;
  actingAsDisplayName?: string | null;
}): RecordEventStackedLabel => {
  if (item.actorKind === 'system' || item.actorKind === 'workflow' || item.actorKind === 'agent') {
    const named = identityLine({
      displayName: item.actorDisplayName,
      username: item.actorUsername,
      userId: item.actorUserId,
    });
    if (named.title !== '—') {
      return {
        title: kindLabel(item.actorKind),
        subtitle: named.subtitle ? `${named.title} · ${named.subtitle}` : named.title,
      };
    }
    return { title: kindLabel(item.actorKind), subtitle: null };
  }
  const actor = identityLine({
    displayName: item.actorDisplayName,
    username: item.actorUsername,
    userId: item.actorUserId,
  });
  if (item.actorKind === 'impersonation') {
    const target = identityLine({
      displayName: item.actingAsDisplayName,
      username: item.actingAsUsername,
      userId: item.actingAsUserId,
    });
    return {
      title: `${actor.title} as ${target.title}`,
      subtitle: [actor.subtitle, target.subtitle].filter(Boolean).join(' → ') || null,
    };
  }
  return actor;
};

export const recordEventReasonLabelFromCatalog = (code?: string | null): string | null => (
  catalogLabelForReasonCode(code)
);

export const recordEventReasonStackedLabel = (item: {
  reasonCode?: string | null;
  reasonText?: string | null;
  reasonLabel?: string | null;
}): RecordEventStackedLabel => {
  const code = item.reasonCode?.trim() || null;
  const text = item.reasonText?.trim() || null;
  const label = item.reasonLabel?.trim() || recordEventReasonLabelFromCatalog(code);
  if (!label && !code && !text) {
    return { title: '—', subtitle: null };
  }
  if (label && text) {
    return { title: label, subtitle: text };
  }
  if (label) {
    return { title: label, subtitle: code && code !== label ? code : null };
  }
  if (text) {
    return { title: text, subtitle: code };
  }
  return { title: '—', subtitle: code };
};

/** Inclusive local-day bound for GET `/api/record-events?from=&to=`. */
export const recordEventDateBound = (value: string, edge: 'start' | 'end'): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const suffix = edge === 'start' ? 'T00:00:00' : 'T23:59:59.999';
  const parsed = new Date(`${trimmed}${suffix}`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
};
