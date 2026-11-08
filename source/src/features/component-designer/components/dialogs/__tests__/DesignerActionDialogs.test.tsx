// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';

import { DesignerDeleteComponentDialog } from '../DesignerDeleteComponentDialog';
import { DesignerDraftDialog } from '../DesignerDraftDialog';
import { DesignerTagsDialog } from '../DesignerTagsDialog';

const renderWithQueryClient = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe('Designer duplicate/delete dialogs', () => {
  afterEach(() => {
    cleanup();
    document.body.querySelectorAll('[data-designer-dialog-backdrop]').forEach((node) => node.remove());
  });

  it('uses the shared blur backdrop for duplicate dialog', () => {
    render(
      <DesignerDraftDialog
        mode="duplicate"
        busy={false}
        error={null}
        activeDraftId="draft-1"
        activeComponentName="hero-section"
        draftNameInput="hero-section-copy"
        onDraftNameInputChange={() => undefined}
        draftTagsInput={[]}
        onDraftTagsInputChange={() => undefined}
        onClose={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const backdrop = document.body.querySelector('dialog.designer-dialog-native');
    expect(backdrop).toBeInTheDocument();
    expect(backdrop).toHaveAttribute('data-designer-dialog-backdrop');
  });

  it('uses the shared blur backdrop for delete dialog', () => {
    renderWithQueryClient(
      <DesignerDeleteComponentDialog
        open
        busy={false}
        error={null}
        componentName="hero-section"
        draftId="draft-1"
        hasUnsavedChanges={false}
        onClose={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const backdrop = document.body.querySelector('dialog.designer-dialog-native');
    expect(backdrop).toBeInTheDocument();
    expect(backdrop).toHaveAttribute('data-designer-dialog-backdrop');
  });

  it('does not dismiss duplicate dialog on backdrop click or Escape', () => {
    const onClose = vi.fn();

    render(
      <DesignerDraftDialog
        mode="duplicate"
        busy={false}
        error={null}
        activeDraftId="draft-1"
        activeComponentName="hero-section"
        draftNameInput="hero-section-copy"
        onDraftNameInputChange={() => undefined}
        draftTagsInput={[]}
        onDraftTagsInputChange={() => undefined}
        onClose={onClose}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const backdrop = document.body.querySelector('dialog.designer-dialog-native');
    expect(backdrop).toBeInTheDocument();

    fireEvent.click(backdrop!);
    backdrop!.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not dismiss save dialog on backdrop click or Escape', () => {
    const onClose = vi.fn();

    render(
      <DesignerDraftDialog
        mode="save"
        busy={false}
        error={null}
        activeDraftId={null}
        activeComponentName="hero-section"
        draftNameInput="hero-section"
        onDraftNameInputChange={() => undefined}
        draftTagsInput={[]}
        onDraftTagsInputChange={() => undefined}
        onClose={onClose}
        onCancel={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const backdrop = document.body.querySelector('dialog.designer-dialog-native');
    expect(backdrop).toBeInTheDocument();

    fireEvent.click(backdrop!);
    backdrop!.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('saves a tag as soon as it is created in the Tags dialog', () => {
    const onTagsChange = vi.fn();

    render(
      <DesignerTagsDialog
        open
        error={null}
        componentName="hero-section"
        tags={[]}
        suggestions={['billing']}
        onTagsChange={onTagsChange}
        onClose={vi.fn()}
      />,
    );

    const backdrop = document.body.querySelector('dialog.designer-dialog-native');
    expect(backdrop).toBeInTheDocument();
    expect(backdrop?.querySelector('.max-w-4xl')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryByText('Tags', { selector: 'label' })).not.toBeInTheDocument();
    expect(screen.getByText('hero-section')).toHaveClass('text-indigo-700');
    expect(screen.getByText('Type a tag and press Enter to create it. Changes save as you add or remove a tag.')).toBeInTheDocument();

    const input = screen.getByRole('combobox', { name: 'Tags' });
    fireEvent.change(input, { target: { value: 'crm' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onTagsChange).toHaveBeenCalledWith(['crm']);
  });
});
