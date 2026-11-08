// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { DesignerDialog } from '../DesignerDialog';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = HTMLDialogElement.prototype.showModal ?? function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = HTMLDialogElement.prototype.close ?? function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

describe('DesignerDialog keyboard focus', () => {
  afterEach(() => {
    cleanup();
    document.body.querySelectorAll('[data-designer-dialog-backdrop]').forEach((node) => node.remove());
  });

  it('renders a native dialog shell on document.body', () => {
    render(
      <DesignerDialog title="Test Dialog" open onClose={() => undefined}>
        <p>Body</p>
      </DesignerDialog>,
    );

    const dialog = document.body.querySelector('dialog[data-designer-dialog-backdrop]');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveClass('designer-dialog-native');
    expect(dialog).toHaveAttribute('open');
  });

  it('renders duplicate and delete dialogs with the shared native dialog shell', () => {
    const { rerender } = render(
      <DesignerDialog title="Duplicate Component" open onClose={() => undefined}>
        <p>Duplicate body</p>
      </DesignerDialog>,
    );

    expect(document.body.querySelector('dialog.designer-dialog-native')).toBeInTheDocument();

    rerender(
      <DesignerDialog title="Delete Component" open tone="danger" onClose={() => undefined}>
        <p>Delete body</p>
      </DesignerDialog>,
    );

    expect(document.body.querySelector('dialog.designer-dialog-native')).toBeInTheDocument();
  });

  it('keeps Tab focus cycle inside dialog', async () => {
    const onClose = vi.fn();

    render(
      <>
        <button type="button">Outside Trigger</button>
        <DesignerDialog
          title="Test Dialog"
          open
          onClose={onClose}
          footer={(
            <div>
              <button type="button">Footer First</button>
              <button type="button">Footer Last</button>
            </div>
          )}
        >
          <button type="button">Body Action</button>
        </DesignerDialog>
      </>,
    );

    const closeButton = screen.getByRole('button', { name: 'Close dialog' });
    const footerLast = screen.getByRole('button', { name: 'Footer Last' });

    await waitFor(() => {
      expect(closeButton).toHaveFocus();
    });

    footerLast.focus();
    expect(footerLast).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(footerLast).toHaveFocus();
  });

  it('does not dismiss on backdrop click when closeOnBackdrop is false', () => {
    const onClose = vi.fn();

    render(
      <DesignerDialog title="Save Component" open closeOnBackdrop={false} onClose={onClose}>
        <p>Body</p>
      </DesignerDialog>,
    );

    const dialog = document.body.querySelector('dialog[data-designer-dialog-backdrop]');
    expect(dialog).toBeInTheDocument();

    fireEvent.click(dialog!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not dismiss on Escape when closeOnEscape is false', () => {
    const onClose = vi.fn();

    render(
      <DesignerDialog title="Save Component" open closeOnEscape={false} onClose={onClose}>
        <p>Body</p>
      </DesignerDialog>,
    );

    const dialog = document.body.querySelector('dialog[data-designer-dialog-backdrop]');
    dialog!.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('still dismisses via header close button when backdrop and escape are disabled', () => {
    const onClose = vi.fn();

    render(
      <DesignerDialog title="Save Component" open closeOnBackdrop={false} closeOnEscape={false} onClose={onClose}>
        <p>Body</p>
      </DesignerDialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
