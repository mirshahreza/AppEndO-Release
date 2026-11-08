/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CultureProvider } from '../../../../core/culture/CultureContext';
import { bootstrapCultureRegistry } from '../../../../core/culture/CultureRegistry';
import { HwyGeoResponsibilityInlineListDialogHost } from '../../../../features/hwy-geo-responsibility/HwyGeoResponsibilityInlineListDialogHost';
import { HwyElectoralDivisionPathLinks } from '../HwyElectoralDivisionPathLinks';

vi.mock('../../../../domain/hwy/hwyGeoResponsibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../domain/hwy/hwyGeoResponsibility')>();
  return {
    ...actual,
    fetchHwyGeoResponsibilityConfig: vi.fn(async () => ({ levels: [] })),
    listHwyGeoResponsibilityNodes: vi.fn(async () => ({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 25,
    })),
  };
});

describe('HwyElectoralDivisionPathLinks', () => {
  it('opens the inline geo-responsibility list dialog when a segment is clicked', () => {
    bootstrapCultureRegistry(['iq']);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CultureProvider cultureId="iq">
          <HwyGeoResponsibilityInlineListDialogHost>
            <HwyElectoralDivisionPathLinks
              value="بغداد | الرصافة | دائرة الزعفرانية | الربيع | مدرسة"
              layout="inline"
            />
          </HwyGeoResponsibilityInlineListDialogHost>
        </CultureProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'بغداد' }));
    expect(screen.getByRole('dialog', { name: 'بغداد' })).toBeInTheDocument();
  });
});
