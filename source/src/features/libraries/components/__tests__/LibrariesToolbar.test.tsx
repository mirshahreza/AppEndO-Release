/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CultureProvider } from '../../../../core/culture/CultureContext';
import { BUILTIN_FILTER_ALL } from '../../../../shared/lib/builtInFilter';
import { LibrariesToolbar } from '../LibrariesToolbar';

describe('LibrariesToolbar', () => {
  it('uses the shared BuiltIn filter instead of mixing BuiltIn into Kind', async () => {
    const onBuiltInFilterChange = vi.fn();
    render(
      <CultureProvider cultureId="us">
        <LibrariesToolbar
          searchInput=""
          onSearchInputChange={vi.fn()}
          builtInFilter={BUILTIN_FILTER_ALL}
          onBuiltInFilterChange={onBuiltInFilterChange}
          onInstall={vi.fn()}
          onRefresh={vi.fn()}
          isRefreshing={false}
        />
      </CultureProvider>,
    );

    expect(screen.queryByRole('button', { name: /Kind/i })).not.toBeInTheDocument();
    const builtInTrigger = screen.getByRole('button', { name: /BuiltIn/i });
    expect(builtInTrigger.textContent).toMatch(/All/);

    await act(async () => {
      fireEvent.click(builtInTrigger);
    });

    expect(await screen.findByRole('option', { name: 'BuiltIn' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Not BuiltIn' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Custom' })).not.toBeInTheDocument();
  });
});
