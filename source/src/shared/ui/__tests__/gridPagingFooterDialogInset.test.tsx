/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { DialogHostProvider } from '../dialog/DialogHostContext';
import { GridPagingFooter } from '../GridPagingFooter';
import {
  CREATE_EDIT_MODAL_GRID_PAGING_FOOTER_CLASS,
  GRID_PAGING_FOOTER_CLASS,
  HERO_TABLE_HEADER_CORNER_CLASS,
  HERO_TABLE_JOINED_SHELL_CLASS,
  HERO_TABLE_PAGING_FOOTER_CLASS,
} from '../surfaceClasses';

afterEach(cleanup);

const baseProps = {
  totalCount: 40,
  safePage: 1,
  pageSize: 20,
  onPageSizeChange: () => undefined,
  sortBy: 'title' as const,
  sortOptions: [{ value: 'title' as const, label: 'Title' }],
  onSortByChange: () => undefined,
  sortDirection: 'asc' as const,
  onToggleSortDirection: () => undefined,
  totalPages: 2,
  pageNumbers: [1, 2],
  onPageChange: () => undefined,
  showSortControls: false,
};

describe('GridPagingFooter dialog inset', () => {
  it('defaults nav buttons to icon-only with accessible labels', () => {
    render(<GridPagingFooter {...baseProps} showFirstLast />);
    expect(screen.getByRole('button', { name: /first/i })).toHaveClass('w-8');
    expect(screen.getByRole('button', { name: /prev/i })).toHaveClass('w-8');
    expect(screen.getByRole('button', { name: /next/i })).toHaveClass('w-8');
    expect(screen.getByRole('button', { name: /last/i })).toHaveClass('w-8');
  });

  it('shows icon and text when navButtonLabelMode is iconAndLabel', () => {
    render(<GridPagingFooter {...baseProps} navButtonLabelMode="iconAndLabel" />);
    const prev = screen.getByRole('button', { name: /prev/i });
    expect(prev.textContent?.toLowerCase()).toContain('prev');
  });

  it('uses page footer chrome outside dialogs', () => {
    const { container } = render(<GridPagingFooter {...baseProps} />);
    const footer = container.firstElementChild as HTMLElement;
    expect(footer.className).toContain('sm:px-5');
    expect(footer.className).not.toContain('mx-[10px]');
  });

  it('auto-insets 10px from window edges inside AppDialogShell host', () => {
    const { container } = render(
      <DialogHostProvider>
        <GridPagingFooter {...baseProps} />
      </DialogHostProvider>,
    );
    const footer = container.firstElementChild as HTMLElement;
    expect(footer.className).toContain('mx-[10px]');
    expect(CREATE_EDIT_MODAL_GRID_PAGING_FOOTER_CLASS).toContain('mx-[10px]');
    expect(GRID_PAGING_FOOTER_CLASS).not.toContain('mx-[10px]');
  });

  it('allows opting out of dialog inset', () => {
    const { container } = render(
      <DialogHostProvider>
        <GridPagingFooter {...baseProps} edgeAlignInDialog={false} />
      </DialogHostProvider>,
    );
    const footer = container.firstElementChild as HTMLElement;
    expect(footer.className).not.toContain('mx-[10px]');
    expect(footer.className).toContain('sm:px-5');
  });

  it('uses classic paging on Hero chrome inside a 1px rounded joined shell', () => {
    const { container } = render(
      <DialogHostProvider>
        <GridPagingFooter {...baseProps} chrome="hero" />
      </DialogHostProvider>,
    );
    const footer = container.firstElementChild as HTMLElement;
    expect(footer.getAttribute('data-grid-paging-chrome')).toBe('hero');
    expect(footer.className).toContain('bg-white');
    expect(footer.className).toContain('border-t');
    expect(footer.className).toContain('sm:px-5');
    expect(footer.className).not.toContain('rounded-b-[8px]');
    expect(footer.className).not.toContain('mx-[10px]');
    expect(container.querySelector('[data-slot="pagination"]')).toBeNull();
    expect(screen.getByRole('button', { name: /first/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prev/i })).toBeInTheDocument();
    expect(HERO_TABLE_PAGING_FOOTER_CLASS).toContain('bg-white');
    expect(HERO_TABLE_PAGING_FOOTER_CLASS).toContain('border-t');
    expect(HERO_TABLE_JOINED_SHELL_CLASS).toContain('border-slate-100');
    expect(HERO_TABLE_JOINED_SHELL_CLASS).toContain('rounded-[8px]');
    expect(HERO_TABLE_HEADER_CORNER_CLASS).toContain('bg-slate-100');
    expect(HERO_TABLE_HEADER_CORNER_CLASS).toContain('rounded-ss-[8px]');
    expect(GRID_PAGING_FOOTER_CLASS).not.toContain('bg-white');
  });

  it('hides the page-size dropdown when showPageSizeControls is false', () => {
    render(<GridPagingFooter {...baseProps} showPageSizeControls={false} />);
    expect(screen.queryByLabelText('Items per page')).not.toBeInTheDocument();
  });
});
