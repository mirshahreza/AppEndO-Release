import { describe, expect, it } from 'vitest';
import { resolveInboxOriginLabel, resolveInboxSourceDetailLabel } from '../shellInboxCultureLabels';
import type { PersonalInboxItem } from '../../api/contracts/personal-inbox/types';

const base = (kind: PersonalInboxItem['kind'], overrides: Partial<PersonalInboxItem> = {}): PersonalInboxItem => ({
  id: `${kind}:1`,
  kind,
  origin: 'X',
  originDetail: null,
  title: 'T',
  summary: null,
  surfacedAt: '2026-01-01T00:00:00.000Z',
  attention: 'none',
  href: 'my-inbox',
  ref: kind === 'work_item'
    ? { type: 'work_item', id: 1 }
    : kind === 'feedback'
      ? { type: 'feedback', id: 1 }
      : { type: 'notification', id: 1 },
  ...overrides,
});

describe('resolveInboxOriginLabel', () => {
  it('maps kinds to culture fallbacks when t is undefined', () => {
    expect(resolveInboxOriginLabel(undefined, base('work_item'))).toBe('Workflow');
    expect(resolveInboxOriginLabel(undefined, base('feedback'))).toBe('Feedback');
    expect(resolveInboxOriginLabel(undefined, base('alert'))).toBe('Alert');
  });
});

describe('resolveInboxSourceDetailLabel', () => {
  it('translates notification workflow source', () => {
    const item = base('alert', { origin: 'Alert', originDetail: 'workflow' });
    expect(resolveInboxSourceDetailLabel(undefined, item)).toBe('Workflow');
  });

  it('translates work item type keys when present', () => {
    const t = (key: string, opts?: { missing?: string }) => {
      if (key === 'shell.inbox.sourceDetail.workItemType.TASK') {
        return 'مهمة';
      }
      return opts?.missing === 'silent' ? key : key;
    };
    const item = base('work_item', { origin: 'Workflow', originDetail: 'TASK' });
    expect(resolveInboxSourceDetailLabel(t, item)).toBe('مهمة');
  });

  it('falls back to origin label when detail is empty', () => {
    expect(resolveInboxSourceDetailLabel(undefined, base('work_item'))).toBe('Workflow');
  });
});
