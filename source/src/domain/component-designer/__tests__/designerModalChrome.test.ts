import React from 'react';
import { describe, expect, it } from 'vitest';
import {
  DESIGNER_DIALOG_FOOTER_ACTIONS_CLASS,
  DESIGNER_MODAL_DIALOG_SHELL_CLASS,
  DESIGNER_MODAL_SHELL_BODY_INNER_CLASS,
  DESIGNER_MODAL_SHELL_BODY_INNER_FILL_CLASS,
  DESIGNER_MODAL_SHELL_BODY_OUTER_FILL_FLUSH_CLASS,
  DESIGNER_MODAL_SHELL_BODY_OUTER_FLUSH_CLASS,
  liftDesignerDialogFooterElement,
  mergeDesignerModalDialogClassName,
  resolveDesignerModalHeaderClassName,
  resolveDesignerModalHeaderTone,
  resolveDesignerModalShellBodyClassNames,
  resolveDesignerModalTitleClassName,
} from '../designerModalChrome';

describe('designerModalChrome', () => {
  it('defaults alert-dialog tone to danger and modal to default', () => {
    expect(resolveDesignerModalHeaderTone('heroui.alert-dialog', undefined)).toBe('danger');
    expect(resolveDesignerModalHeaderTone('heroui.modal', undefined)).toBe('default');
    expect(resolveDesignerModalHeaderTone('heroui.alert-dialog', 'default')).toBe('default');
  });

  it('uses Base Components title weight (font-bold) for both tones', () => {
    expect(resolveDesignerModalTitleClassName('default')).toContain('font-bold');
    expect(resolveDesignerModalTitleClassName('danger')).toContain('text-rose-800');
    expect(resolveDesignerModalHeaderClassName('danger')).toContain('bg-rose-50/80');
  });

  it('uses a fill flex body chain for maximized modals so grid footers stick to the bottom', () => {
    expect(resolveDesignerModalShellBodyClassNames({
      size: 'maximized',
      hasActionFooter: false,
    })).toEqual({
      bodyOuterClassName: DESIGNER_MODAL_SHELL_BODY_OUTER_FILL_FLUSH_CLASS,
      bodyClassName: DESIGNER_MODAL_SHELL_BODY_INNER_FILL_CLASS,
    });
    expect(resolveDesignerModalShellBodyClassNames({
      size: '5xl',
      hasActionFooter: false,
    })).toEqual({
      bodyOuterClassName: DESIGNER_MODAL_SHELL_BODY_OUTER_FLUSH_CLASS,
      bodyClassName: DESIGNER_MODAL_SHELL_BODY_INNER_CLASS,
    });
  });

  it('liftDesignerDialogFooterElement wraps Fragment footers in a div (not cloneElement)', () => {
    const lifted = liftDesignerDialogFooterElement(
      React.createElement(
        React.Fragment,
        null,
        React.createElement('button', { type: 'button' }, 'Cancel'),
        React.createElement('button', { type: 'button' }, 'Delete'),
      ),
    );

    expect(React.isValidElement(lifted)).toBe(true);
    expect((lifted as React.ReactElement).type).toBe('div');
    expect((lifted as React.ReactElement<{ className?: string }>).props.className)
      .toContain(DESIGNER_DIALOG_FOOTER_ACTIONS_CLASS);
  });

  it('merges width utilities onto the standard shell and strips legacy chrome', () => {
    const merged = mergeDesignerModalDialogClassName(
      'w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl',
      'lg',
    );
    expect(merged).toContain(DESIGNER_MODAL_DIALOG_SHELL_CLASS);
    expect(merged).toContain('max-w-lg');
    expect(merged).not.toContain('shadow-xl');
    // Author max-w / w-full stripped; size token from CreateEditModalShell supplies max-w-lg.
    expect(merged.split(DESIGNER_MODAL_DIALOG_SHELL_CLASS).join('').trim()).toMatch(/max-w-lg/);
  });
});
