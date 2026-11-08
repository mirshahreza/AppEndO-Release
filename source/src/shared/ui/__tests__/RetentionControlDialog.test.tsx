/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOG_RETENTION } from '../../api/contracts/settings/retention';
import { RetentionControlDialog } from '../retention-control/RetentionControlDialog';

const postRetentionDryRun = vi.fn();
const postRetentionRun = vi.fn();
const clearLogs = vi.fn();
const clearRecordEvents = vi.fn();
const refetchSettings = vi.fn(async () => undefined);
const refetchDestinations = vi.fn(async () => undefined);

vi.mock('../../../core/culture/CultureContext', () => ({
  useCultureT: () => (key: string) => {
    const labels: Record<string, string> = {
      'operations.logs.control': 'Control logs',
      'operations.logs.control.subtitle': 'Control logs subtitle',
      'operations.retention.dryRun': 'Dry-run',
      'operations.retention.runNow': 'Run now',
      'operations.common.clear': 'Clear',
      'operations.common.start': 'Start',
      'operations.common.done': 'Done',
      'operations.logs.retention.dryRunInfo': 'Dry-run explanation',
      'operations.logs.retention.runNowInfo': 'Run now explanation',
      'operations.logs.clearInfo': 'Clear explanation',
      'operations.retention.control.savedSettings': 'Saved settings',
      'operations.retention.dryRunConfirmQuestion.logs': 'Start dry-run?',
      'operations.retention.dryRunConfirmWarning': 'Nothing is changed.',
      'operations.retention.control.dryRunWorking': 'Counting matching rows…',
      'operations.retention.control.dryRunResultLead': 'Preview finished.',
      'operations.retention.runNowConfirmQuestion.logs': 'Queue retention?',
      'operations.retention.runNowConfirmWarning': 'Watch Jobs after it is queued.',
      'operations.retention.control.runNowWorking': 'Queuing the retention job…',
      'operations.retention.control.runNowResultLead': 'Retention was queued.',
      'operations.retention.control.watchJobs': 'Open Jobs to watch progress.',
      'operations.retention.control.jobIds': 'Job ids',
      'operations.logs.clearTitle': 'Clear Logs',
      'operations.logs.clearConfirm': 'Are you sure you want to clear all logs?',
      'operations.logs.clearConfirmWarning': 'This cannot be undone.',
      'operations.logs.clearWorking': 'Clearing hot logs…',
      'operations.logs.clearResult': 'Hot logs were cleared.',
      'operations.recordEvents.control': 'Control records',
      'operations.recordEvents.control.subtitle': 'Control records subtitle',
      'operations.recordEvents.retention.dryRunInfo': 'Record events dry-run explanation',
      'operations.recordEvents.retention.runNowInfo': 'Record events run now explanation',
      'operations.recordEvents.clearInfo': 'Record events clear explanation',
      'operations.retention.dryRunConfirmQuestion.recordEvents': 'Start record-events dry-run?',
      'operations.retention.runNowConfirmQuestion.recordEvents': 'Queue record-events retention?',
      'operations.recordEvents.clearTitle': 'Clear record events',
      'operations.recordEvents.clearConfirm': 'Are you sure you want to clear all record events? Held records are kept.',
      'operations.recordEvents.clearConfirmWarning': 'This cannot be undone.',
      'operations.recordEvents.clearWorking': 'Clearing hot record events…',
      'operations.recordEvents.clearResult': 'Hot record events were cleared.',
      'operations.retention.control.deleted': 'Deleted',
      'settings.forms.logs.retention.recordEvents': 'Record events',
      'operations.retention.control.matched': 'Matched',
      'operations.retention.control.skippedHold': 'Skipped (hold)',
      'settings.forms.logs.retention.appLogs': 'App logs',
      'settings.forms.logs.retention.authAudit': 'Auth audit',
      'settings.forms.logs.retention.olderThan': 'Older than',
      'settings.forms.logs.retention.destination': 'Destination',
      'settings.forms.logs.retention.file': 'File',
      'settings.forms.logs.retention.sameTypeDb': 'Same-type database',
      'settings.forms.logs.retention.notUsed': 'Not used',
    };
    return labels[key] ?? key;
  },
  useOptionalCulture: () => null,
  useOptionalCultureT: () => undefined,
}));

vi.mock('../../api/queries/logs', () => ({
  useLogViewerSettingsQuery: () => ({
    data: { logRetention: DEFAULT_LOG_RETENTION },
    isFetching: false,
    isError: false,
    refetch: refetchSettings,
  }),
  useClearLogsMutation: () => ({
    mutateAsync: clearLogs,
  }),
}));

vi.mock('../../api/queries/recordEvents', () => ({
  useClearRecordEventsMutation: () => ({
    mutateAsync: clearRecordEvents,
  }),
}));

vi.mock('../../api/queries/retention', async () => {
  const actual = await vi.importActual<typeof import('../../api/queries/retention')>(
    '../../api/queries/retention',
  );
  return {
    ...actual,
    useRetentionDestinationsQuery: () => ({
      data: [{ id: 'conn-1', name: 'Archive DB', type: 'mssql' }],
      isFetching: false,
      isError: false,
      refetch: refetchDestinations,
    }),
    postRetentionDryRun: (...args: unknown[]) => postRetentionDryRun(...args),
    postRetentionRun: (...args: unknown[]) => postRetentionRun(...args),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RetentionControlDialog', () => {
  it('runs dry-run through confirm, progress, result, and Done back to the parent closer', async () => {
    postRetentionDryRun.mockResolvedValue({
      dryRun: true,
      scope: 'logs',
      families: {
        appLogs: { matched: 4, skippedHold: 1, copied: 0, deleted: 0, bytesEstimate: 0 },
        authAudit: { matched: 2, skippedHold: 0, copied: 0, deleted: 0, bytesEstimate: 0 },
      },
    });
    const onClose = vi.fn();
    render(<RetentionControlDialog open onClose={onClose} scope="logs" />);

    expect(screen.getAllByText('Saved settings')).toHaveLength(1);
    const actionButtons = [
      screen.getAllByRole('button', { name: 'Dry-run' })[0],
      screen.getAllByRole('button', { name: 'Run now' })[0],
      screen.getByRole('button', { name: 'Clear' }),
    ];
    expect(new Set(actionButtons.map((button) => button.className))).toHaveLength(1);
    expect(actionButtons[0].className).toMatch(/w-32/);
    fireEvent.click(actionButtons[0]);
    expect(screen.getByText('Start dry-run?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => {
      expect(screen.getByText('Preview finished.')).toBeInTheDocument();
    });
    expect(postRetentionDryRun).toHaveBeenCalledWith('logs');
    expect(screen.getByText(/Matched: 4/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('queues run now through confirm, result, and Done', async () => {
    postRetentionRun.mockResolvedValue({ jobIds: [42] });
    const onClose = vi.fn();
    render(<RetentionControlDialog open onClose={onClose} scope="logs" />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Run now' })[0]);
    expect(screen.getByText('Queue retention?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => {
      expect(screen.getByText('Retention was queued.')).toBeInTheDocument();
    });
    expect(postRetentionRun).toHaveBeenCalledWith('logs');
    expect(screen.getByText(/Job ids: 42/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('clears logs through confirm, result, and Done', async () => {
    clearLogs.mockResolvedValue(undefined);
    const onClose = vi.fn();
    const onCleared = vi.fn();
    render(<RetentionControlDialog open onClose={onClose} scope="logs" onCleared={onCleared} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Are you sure you want to clear all logs?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => {
      expect(screen.getByText('Hot logs were cleared.')).toBeInTheDocument();
    });
    expect(clearLogs).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
    expect(onCleared).toHaveBeenCalled();
  });

  it('runs record-events dry-run through confirm, result, and Done', async () => {
    postRetentionDryRun.mockResolvedValue({
      dryRun: true,
      scope: 'recordEvents',
      families: {
        recordEvents: { matched: 9, skippedHold: 2, copied: 0, deleted: 0, bytesEstimate: 0 },
      },
    });
    const onClose = vi.fn();
    render(<RetentionControlDialog open onClose={onClose} scope="recordEvents" />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Dry-run' })[0]);
    expect(screen.getByText('Start record-events dry-run?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => {
      expect(screen.getByText('Preview finished.')).toBeInTheDocument();
    });
    expect(postRetentionDryRun).toHaveBeenCalledWith('recordEvents');
    expect(screen.getByText(/Matched: 9/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('queues record-events run now through confirm, result, and Done', async () => {
    postRetentionRun.mockResolvedValue({ jobIds: [7] });
    const onClose = vi.fn();
    render(<RetentionControlDialog open onClose={onClose} scope="recordEvents" />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Run now' })[0]);
    expect(screen.getByText('Queue record-events retention?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => {
      expect(screen.getByText('Retention was queued.')).toBeInTheDocument();
    });
    expect(postRetentionRun).toHaveBeenCalledWith('recordEvents');
    expect(screen.getByText(/Job ids: 7/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('clears record events through confirm, result, and Done', async () => {
    clearRecordEvents.mockResolvedValue({ deleted: 11, skipped: 3 });
    const onClose = vi.fn();
    const onCleared = vi.fn();
    render(<RetentionControlDialog open onClose={onClose} scope="recordEvents" onCleared={onCleared} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Are you sure you want to clear all record events? Held records are kept.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => {
      expect(screen.getByText('Hot record events were cleared.')).toBeInTheDocument();
    });
    expect(clearRecordEvents).toHaveBeenCalled();
    expect(screen.getByText(/Deleted: 11/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
    expect(onCleared).toHaveBeenCalled();
  });
});
