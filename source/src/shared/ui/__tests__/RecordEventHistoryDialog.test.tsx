/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRecordEvents } from '../../api/queries/recordEvents';
import type { RecordEventPublicRow } from '../../api/contracts/record-events';
import {
  formatRecordEventOccurredAt,
  recordEventActorStackedLabel,
  recordEventDateBound,
  recordEventReasonStackedLabel,
} from '../../lib/formatRecordEventValue';
import { RecordEventHistoryDialog } from '../RecordEventHistoryDialog';
import { createRecordSubjectHistoryGridColumns } from '../recordEventHistoryGridColumns';
import { USER_PROFILE_HISTORY_FIELD_MAP } from '../../lib/recordEventHistoryFields';

vi.mock('../../../core/culture/CultureContext', () => ({
  useCultureT: () => (key: string) => key,
  useOptionalCulture: () => null,
  useOptionalCultureT: () => undefined,
}));

vi.mock('../../api/queries/recordEvents', () => ({
  fetchRecordEvents: vi.fn(async () => ({
    data: { success: true, items: [], totalCount: 0 },
    response: { ok: true, status: 200 },
  })),
}));

afterEach(cleanup);

describe('recordEventDateBound', () => {
  it('builds inclusive local-day bounds', () => {
    expect(recordEventDateBound('2026-01-15', 'start')).toBe(new Date('2026-01-15T00:00:00').toISOString());
    expect(recordEventDateBound('2026-01-15', 'end')).toBe(new Date('2026-01-15T23:59:59.999').toISOString());
    expect(recordEventDateBound('  ', 'start')).toBeUndefined();
  });
});

describe('formatRecordEventOccurredAt', () => {
  it('formats local time as yyyy-mm-dd hh:mm', () => {
    expect(formatRecordEventOccurredAt(new Date(2026, 0, 5, 9, 7).toISOString())).toBe('2026-01-05 09:07');
  });
});

const historyRow = (overrides: Partial<RecordEventPublicRow> = {}): RecordEventPublicRow => ({
  id: '1',
  subjectKind: 'base_users',
  subjectId: '7',
  occurredAt: new Date(2026, 8, 12, 16, 13).toISOString(),
  actorUserId: 100000,
  actingAsUserId: null,
  actorKind: 'user',
  outcome: 'success',
  source: 'patch',
  sourceRef: null,
  requestId: null,
  eventKind: 'field.changed',
  field: 'profile.lastname',
  fromValue: { value: 'A' },
  toValue: { value: 'B' },
  reasonCode: '100.6.1',
  reasonText: null,
  reasonLabel: null,
  actorUsername: 'admin',
  actorDisplayName: 'Mohsen Admin',
  correlationId: 'c1',
  subjectSeq: 1,
  clientChannel: null,
  clientInstallId: null,
  clientJson: null,
  payload: null,
  ...overrides,
});

describe('record event actor and reason labels', () => {
  it('uses display name as the actor title', () => {
    expect(recordEventActorStackedLabel(historyRow())).toEqual({
      title: 'Mohsen Admin',
      subtitle: 'admin · #100000',
    });
  });

  it('uses catalog title for a reason code', () => {
    expect(recordEventReasonStackedLabel({ reasonCode: '100.6.1' })).toEqual({
      title: 'Correction',
      subtitle: '100.6.1',
    });
  });

  it('puts reason text under the title', () => {
    expect(recordEventReasonStackedLabel({
      reasonCode: '100.6.1',
      reasonText: 'Fixed spelling',
    })).toEqual({
      title: 'Correction',
      subtitle: 'Fixed spelling',
    });
  });

  it('paints identity and reason title in History cells', () => {
    const columns = createRecordSubjectHistoryGridColumns({});
    const actor = columns.find((column) => column.id === 'actorUserId');
    const reason = columns.find((column) => column.id === 'reason');
    render(
      <>
        {actor?.renderCell(historyRow())}
        {reason?.renderCell(historyRow({ reasonText: 'Fixed spelling' }))}
      </>,
    );
    expect(screen.getByText('Mohsen Admin')).toBeInTheDocument();
    expect(screen.getByText('admin · #100000')).toBeInTheDocument();
    expect(screen.getByText('Correction')).toBeInTheDocument();
    expect(screen.getByText('Fixed spelling')).toBeInTheDocument();
  });
});

describe('RecordEventHistoryDialog', () => {
  it('opens maximized with date range and field filters', async () => {
    render(
      <RecordEventHistoryDialog
        open
        title="History"
        subjectKind="base_sample_mock_records"
        subjectId="1"
        onClose={() => undefined}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByLabelText('Event kind')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by field')).toBeInTheDocument();
    expect(screen.getByLabelText('From date')).toBeInTheDocument();
    expect(screen.getByLabelText('To date')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('No history yet.')).toBeInTheDocument();
    });
  });

  it('maps Users form field filters to stored event fields', async () => {
    const fetchMock = vi.mocked(fetchRecordEvents);
    fetchMock.mockClear();
    render(
      <RecordEventHistoryDialog
        open
        title="History · firstName"
        subjectKind="base_users"
        subjectId="7"
        field="firstName"
        fieldMap={USER_PROFILE_HISTORY_FIELD_MAP}
        onClose={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => (
        call[0]?.subjectKind === 'base_users'
        && call[0]?.subjectId === '7'
        && call[0]?.field === 'profile.firstname'
        && call[0]?.includeAuth === '1'
        && call[0]?.limit === 50
        && call[0]?.offset === 0
      ))).toBe(true);
    });
  });
});
