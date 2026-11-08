// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkbookCreateModal } from '../components/WorkbookCreateModal';

describe('WorkbookCreateModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('creates a named personal workbook', () => {
    const onCreate = vi.fn();
    render(
      <WorkbookCreateModal
        open
        isSaving={false}
        error={null}
        onClose={() => undefined}
        onCreate={onCreate}
      />,
    );
    fireEvent.change(screen.getByLabelText('Workbook name'), { target: { value: 'Rate card' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onCreate).toHaveBeenCalledWith({ name: 'Rate card' });
  });
});
