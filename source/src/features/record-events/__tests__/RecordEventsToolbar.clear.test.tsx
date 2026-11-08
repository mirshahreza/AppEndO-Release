/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecordEventsToolbar } from '../components/RecordEventsToolbar';
import type { RecordEventsPageModel } from '../hooks/useRecordEventsPage';

vi.mock('../../../core/culture/CultureContext', () => ({
  useCultureT: () => (key: string) => {
    if (key === 'operations.recordEvents.control') return 'Control records';
    if (key === 'operations.recordEvents.includeArchived') return 'Include archived';
    if (key === 'actions.filter') return 'Filter';
    return key;
  },
  useOptionalCulture: () => null,
  useOptionalCultureT: () => undefined,
}));

afterEach(cleanup);

const page = {
  filterActive: false,
  filterConditionCount: 0,
  openFilter: vi.fn(),
  filterButtonProps: {
    active: false,
    conditionCount: 0,
    onClick: vi.fn(),
  },
  logMessage: null,
  clearLogMessage: vi.fn(),
  setShowControlDialog: vi.fn(),
  loadEvents: vi.fn(),
  isLoading: false,
  includeArchivedAllowed: true,
  includeArchived: false,
  setIncludeArchived: vi.fn(),
} as unknown as RecordEventsPageModel;

describe('RecordEventsToolbar Control records', () => {
  it('opens the control dialog from the actions cluster', () => {
    render(<RecordEventsToolbar page={page} />);
    fireEvent.click(screen.getByRole('button', { name: 'Control records' }));
    expect(page.setShowControlDialog).toHaveBeenCalledWith(true);
  });

  it('does not show Signed export, Clear, Dry-run, or Run now on the toolbar', () => {
    render(<RecordEventsToolbar page={page} />);
    expect(screen.queryByRole('button', { name: /Signed export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dry-run' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run now' })).not.toBeInTheDocument();
  });

  it('keeps Include archived and Filter in the filters cluster; Refresh in actions', () => {
    render(<RecordEventsToolbar page={page} />);
    const includeArchived = screen.getByLabelText('Include archived');
    const filter = screen.getByRole('button', { name: 'Filter' });
    const refresh = screen.getByRole('button', { name: 'Refresh' });
    expect(screen.queryByLabelText('Entity')).not.toBeInTheDocument();
    expect(includeArchived.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(filter.compareDocumentPosition(refresh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const control = screen.getByRole('button', { name: 'Control records' });
    expect(control.compareDocumentPosition(refresh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(filter.parentElement).not.toBe(refresh.parentElement);
  });
});
