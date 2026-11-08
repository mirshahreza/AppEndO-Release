/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { AppTableGrid } from '../AppTableGrid';
import * as autoWidth from '../../lib/appTableGridColumnAutoWidth';
import { CultureProvider } from '../../../core/culture/CultureContext';

afterEach(() => {
  cleanup();
});

describe('AppTableGrid column auto-fit', () => {
  it('double-clicking the resize handle sets width from measureAppTableGridColumnAutoWidth', () => {
    const measureSpy = vi.spyOn(autoWidth, 'measureAppTableGridColumnAutoWidth').mockReturnValue(312);

    render(
      <CultureProvider cultureId="us">
        <AppTableGrid
          ariaLabel="Auto fit"
          columns={[
            {
              id: 'name',
              label: 'Name',
              renderCell: (row: { name: string }) => row.name,
            },
          ]}
          rows={[{ name: 'Alpha' }, { name: 'Beta with a longer label' }]}
          getRowKey={(row) => row.name}
        />
      </CultureProvider>,
    );

    const resizeHandle = screen.getByTitle(/double-click to fit/i);
    fireEvent.doubleClick(resizeHandle);

    expect(measureSpy).toHaveBeenCalledWith(expect.any(HTMLElement), 'name', 48);
    const col = document.querySelector('col');
    expect(col?.getAttribute('style') ?? '').toMatch(/312px/);

    measureSpy.mockRestore();
  });
});
