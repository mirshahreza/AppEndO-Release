import { describe, expect, it } from 'vitest';
import type { PersonalInboxItem } from '../../api/contracts/personal-inbox/types';
import {
  resolvePersonalInboxBellPrimaryLine,
  looksLikeAutoInboxTitle,
} from '../personalInboxBellDisplay';

const alertItem = (title: string, summary: string | null): PersonalInboxItem => ({
  id: 'alert:1',
  kind: 'alert',
  origin: 'Alert',
  originDetail: 'workflow',
  title,
  summary,
  surfacedAt: '2026-01-01T00:00:00.000Z',
  attention: 'unread',
  href: 'my-inbox',
  ref: { type: 'notification', id: 1 },
});

describe('personalInboxBellDisplay', () => {
  it('detects auto inbox titles', () => {
    expect(looksLikeAutoInboxTitle('inbox-alert-1793438561480-9c4n2f')).toBe(true);
    expect(looksLikeAutoInboxTitle('Review request')).toBe(false);
  });

  it('prefers summary when title is auto-generated', () => {
    const item = alertItem(
      'inbox-alert-1793438561480-9c4n2f',
      'Standalone alert for projection refresh',
    );
    expect(resolvePersonalInboxBellPrimaryLine(item)).toBe('Standalone alert for projection refresh');
  });
});
