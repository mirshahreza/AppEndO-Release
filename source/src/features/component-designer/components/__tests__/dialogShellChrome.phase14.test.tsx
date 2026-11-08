// @vitest-environment jsdom

/**
 * Phase 14 — StepWizardShell / DesignerDialog chrome unification:
 * - single outer shell border (no dual CREATE_EDIT_MODAL_SHELL + DIALOG_SHELL_CHROME)
 * - wizard backdrop tint/blur aligned to DesignerDialog ::backdrop (12% + blur 4px)
 * - DesignerPreviewDialog consciously excluded (floating live preview, not blocking modal)
 *
 * Documented intentional backdrop class-string difference (architecture merge out of scope):
 * - DesignerDialog → DESIGNER_DIALOG_BACKDROP_CLASS (`designer-dialog-native`) + CSS ::backdrop
 * - StepWizardShell → STEP_WIZARD_BACKDROP_CLASS (div overlay with matching visual values)
 */

import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@heroui/react', async () => {
  const { componentDesignerHeroUiMock } = await import('../../../../test-support/componentDesignerHeroUiMock');
  return componentDesignerHeroUiMock;
});

vi.mock('../../../../shared/api/queries/my-apis', () => ({
  useAccessibleApiRoutesQuery: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../../../shared/api/queries/api-endpoint-schema', () => ({
  useApiEndpointSchemaQuery: () => ({
    data: null,
    isLoading: false,
    isError: false,
  }),
  fetchEndpointResponseFields: vi.fn(),
  fetchEndpointFormFields: vi.fn(),
  resolveEndpointFormFieldsFromOpenApi: vi.fn(() => []),
  resolveEndpointResponseFormFieldsFromOpenApi: vi.fn(() => []),
}));

import { DesignerDialog, DESIGNER_DIALOG_BACKDROP_CLASS } from '../dialogs/DesignerDialog';
import { StepWizardShell } from '../../../../shared/ui/StepWizardShell';
import {
  CREATE_EDIT_MODAL_BACKDROP_CLASS,
  CREATE_EDIT_MODAL_SHELL_CLASS,
  STEP_WIZARD_BACKDROP_CLASS,
} from '../../../../shared/ui/surfaceClasses';
import { DIALOG_SHELL_CHROME_BORDER_CLASS } from '../../../../shared/ui/surfaceChromeClasses';
import { AutoFormWizardDialog } from '../AutoFormWizardDialog';
import { AutoTableWizardDialog } from '../AutoTableWizardDialog';
import { BindingFormWizardDialog } from '../BindingFormWizardDialog';
import { BindingGridWizardDialog } from '../BindingGridWizardDialog';
import { BindingGridDetailWizardDialog } from '../BindingGridDetailWizardDialog';
import { BindingChartWizardDialog } from '../BindingChartWizardDialog';
import { BindingVizWizardDialog } from '../BindingVizWizardDialog';
import { BindingRepeaterWizardDialog } from '../BindingRepeaterWizardDialog';
import {
  createInitialDesignerState,
  designerReducer,
} from '../../../../domain/component-designer/state';
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = HTMLDialogElement.prototype.showModal
    ?? function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  HTMLDialogElement.prototype.close = HTMLDialogElement.prototype.close
    ?? function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
});

afterEach(() => {
  cleanup();
  document.body.querySelectorAll('[data-designer-dialog-backdrop]').forEach((node) => node.remove());
  document.body.querySelectorAll('[data-step-wizard-backdrop]').forEach((node) => node.remove());
});

const insertNode = (state: ReturnType<typeof createInitialDesignerState>, itemId: string) => {
  const next = designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: state.document.rootNodeId,
  });
  const parent = next.document.nodes[next.document.rootNodeId]!;
  const nodeId = parent.children[parent.children.length - 1] as string;
  return { state: next, nodeId, node: next.document.nodes[nodeId]! };
};

/** Count real border-width utilities on a className (exclude directional borders). */
const countOuterBorderWidthClasses = (className: string): string[] => {
  const tokens = className.split(/\s+/).filter(Boolean);
  return tokens.filter((token) => (
    token === 'border'
    || /^border-\[[\d.]+px\]$/.test(token)
    || /^border-\d+$/.test(token)
  ));
};

describe('Phase 14 — dialog/wizard shell chrome unification', () => {
  it('DesignerDialog backdrop token is designer-dialog-native (CSS ::backdrop 12% + blur 4px)', () => {
    render(
      <DesignerDialog title="Simple Dialog" open onClose={() => undefined}>
        <p>Body</p>
      </DesignerDialog>,
    );

    const dialog = document.body.querySelector('dialog[data-designer-dialog-backdrop]');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveClass(DESIGNER_DIALOG_BACKDROP_CLASS);
    expect(DESIGNER_DIALOG_BACKDROP_CLASS).toBe('designer-dialog-native');
  });

  it('StepWizardShell backdrop uses STEP_WIZARD_BACKDROP_CLASS (12% + blur 4px), not admin 40%', () => {
    render(
      <StepWizardShell
        title="Test wizard"
        steps={[{ title: 'One' }, { title: 'Two' }]}
        step={0}
        onStepChange={vi.fn()}
        onClose={vi.fn()}
      >
        <p>Step body</p>
      </StepWizardShell>,
    );

    const backdrop = document.body.querySelector('[data-step-wizard-backdrop]');
    expect(backdrop).toBeInTheDocument();
    expect(backdrop?.className).toBe(STEP_WIZARD_BACKDROP_CLASS);
    expect(STEP_WIZARD_BACKDROP_CLASS).toContain('bg-slate-900/12');
    expect(STEP_WIZARD_BACKDROP_CLASS).toContain('backdrop-blur-[4px]');
    expect(backdrop?.className).not.toBe(CREATE_EDIT_MODAL_BACKDROP_CLASS);
    expect(CREATE_EDIT_MODAL_BACKDROP_CLASS).toContain('bg-slate-900/40');
  });

  it('documents intentional backdrop class-string difference (native dialog vs div overlay)', () => {
    // Same visual contract (12% slate-900 + 4px blur); different DOM mechanisms by design
    // until a future phase merges StepWizardShell onto <dialog>.
    expect(DESIGNER_DIALOG_BACKDROP_CLASS).toBe('designer-dialog-native');
    expect(STEP_WIZARD_BACKDROP_CLASS).toContain('bg-slate-900/12');
    expect(STEP_WIZARD_BACKDROP_CLASS).toContain('backdrop-blur-[4px]');
    expect(DESIGNER_DIALOG_BACKDROP_CLASS).not.toBe(STEP_WIZARD_BACKDROP_CLASS);
  });

  it('StepWizardShell outer panel has a single border-width class (no dual chrome border)', () => {
    render(
      <StepWizardShell
        title="Border test"
        steps={[{ title: 'A' }, { title: 'B' }]}
        step={0}
        onStepChange={vi.fn()}
        onClose={vi.fn()}
      >
        <p>Body</p>
      </StepWizardShell>,
    );

    const backdrop = document.body.querySelector('[data-step-wizard-backdrop]');
    // SurfaceChromeProvider is context-only — first child is the shell panel.
    const panel = backdrop?.firstElementChild as HTMLElement | null;
    expect(panel).toBeTruthy();
    const className = panel!.className;
    expect(className).toMatch(/\bborder\b/);
    expect(CREATE_EDIT_MODAL_SHELL_CLASS).toContain('border border-slate-200');
    expect(className).not.toContain(DIALOG_SHELL_CHROME_BORDER_CLASS);
    expect(countOuterBorderWidthClasses(className)).toEqual(['border']);
  });

  it('StepWizardShell Cancel on first step still closes', () => {
    const onClose = vi.fn();
    render(
      <StepWizardShell
        title="Close test"
        steps={[{ title: 'First' }, { title: 'Last' }]}
        step={0}
        onStepChange={vi.fn()}
        onClose={onClose}
      >
        <p>Body</p>
      </StepWizardShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Phase 14 — nine StepWizardShell consumer wizards open/close', () => {
  it('AutoFormWizardDialog mounts with unified backdrop and Cancel closes', () => {
    const onClose = vi.fn();
    render(
      <AutoFormWizardDialog open onClose={onClose} onGenerate={vi.fn()} />,
    );
    expect(document.body.querySelector('[data-step-wizard-backdrop]')?.className)
      .toBe(STEP_WIZARD_BACKDROP_CLASS);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('AutoTableWizardDialog mounts with unified backdrop and Cancel closes', () => {
    const onClose = vi.fn();
    render(
      <AutoTableWizardDialog open onClose={onClose} onGenerate={vi.fn()} />,
    );
    expect(document.body.querySelector('[data-step-wizard-backdrop]')?.className)
      .toBe(STEP_WIZARD_BACKDROP_CLASS);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('BindingGridWizardDialog mounts with unified backdrop and Cancel closes', () => {
    const inserted = insertNode(createInitialDesignerState(), 'heroui.data-grid');
    const onClose = vi.fn();
    render(
      <BindingGridWizardDialog
        open
        onClose={onClose}
        document={inserted.state.document}
        gridNode={inserted.node}
        bindingDefinitions={inserted.state.bindingDefinitions}
        dispatch={vi.fn()}
      />,
    );
    expect(document.body.querySelector('[data-step-wizard-backdrop]')?.className)
      .toBe(STEP_WIZARD_BACKDROP_CLASS);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('BindingGridDetailWizardDialog mounts with unified backdrop and Cancel closes', () => {
    const inserted = insertNode(createInitialDesignerState(), 'heroui.data-grid');
    const onClose = vi.fn();
    render(
      <BindingGridDetailWizardDialog
        open
        onClose={onClose}
        document={inserted.state.document}
        gridNode={inserted.node}
        bindingDefinitions={inserted.state.bindingDefinitions}
        dispatch={vi.fn()}
      />,
    );
    expect(document.body.querySelector('[data-step-wizard-backdrop]')?.className)
      .toBe(STEP_WIZARD_BACKDROP_CLASS);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('BindingFormWizardDialog mounts with unified backdrop and Cancel closes', () => {
    const inserted = insertNode(createInitialDesignerState(), 'html.form');
    const onClose = vi.fn();
    render(
      <BindingFormWizardDialog
        open
        onClose={onClose}
        document={inserted.state.document}
        regionNode={inserted.node}
        bindingDefinitions={inserted.state.bindingDefinitions}
        dispatch={vi.fn()}
      />,
    );
    expect(document.body.querySelector('[data-step-wizard-backdrop]')?.className)
      .toBe(STEP_WIZARD_BACKDROP_CLASS);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('BindingChartWizardDialog mounts with unified backdrop and Cancel closes', () => {
    const inserted = insertNode(createInitialDesignerState(), 'viz.chart-bar');
    const onClose = vi.fn();
    render(
      <BindingChartWizardDialog
        open
        onClose={onClose}
        document={inserted.state.document}
        chartNode={inserted.node}
        bindingDefinitions={inserted.state.bindingDefinitions}
        dispatch={vi.fn()}
      />,
    );
    expect(document.body.querySelector('[data-step-wizard-backdrop]')?.className)
      .toBe(STEP_WIZARD_BACKDROP_CLASS);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('BindingVizWizardDialog mounts with unified backdrop and Cancel closes', () => {
    const inserted = insertNode(createInitialDesignerState(), 'viz.tree-view');
    const onClose = vi.fn();
    render(
      <BindingVizWizardDialog
        open
        onClose={onClose}
        document={inserted.state.document}
        vizNode={inserted.node}
        bindingDefinitions={inserted.state.bindingDefinitions}
        dispatch={vi.fn()}
      />,
    );
    expect(document.body.querySelector('[data-step-wizard-backdrop]')?.className)
      .toBe(STEP_WIZARD_BACKDROP_CLASS);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('BindingRepeaterWizardDialog mounts with unified backdrop and Cancel closes', () => {
    const inserted = insertNode(createInitialDesignerState(), 'logic.repeater');
    const onClose = vi.fn();
    render(
      <BindingRepeaterWizardDialog
        open
        onClose={onClose}
        document={inserted.state.document}
        repeaterNode={inserted.node}
        bindingDefinitions={inserted.state.bindingDefinitions}
        dispatch={vi.fn()}
      />,
    );
    expect(document.body.querySelector('[data-step-wizard-backdrop]')?.className)
      .toBe(STEP_WIZARD_BACKDROP_CLASS);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
