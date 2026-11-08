/**
 * Bug found (parity audit U4 / gap #6): Auto Form Builder only produced flat single-step
 * create/edit forms — no multi-step wizard with step gating, store-backed navigation, or
 * live content.stepper activeStep binding.
 * Fixed in autoFormTemplateBuilder.ts / bindingResourceModel.ts: wizard scenario builds
 * visibility-container panels per step, store segment wizardStep.current, setValue Next/Prev
 * actions, Submit only on last step, and content.stepper bound to store.
 */
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  buildAutoFormDocument,
  buildAutoFormSeeds,
  WIZARD_STEP_STORE_SEGMENT,
  type AutoFormBuildConfig,
  type AutoFormFieldConfig,
} from '../autoFormTemplateBuilder';
import { buildDataSourceFromEndpoint, resolveNodePaletteItemId } from '../bindingResourceModel';
import { generateDesignerTsx } from '../codegen';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { resolveRegionSubmitPlanForEvent } from '../bindingRegionEngine';
import { executeDynamicActions } from '../bindingDynamicActionsRuntime';
import { evaluateDesignerCondition } from '../visibilityConditionEngine';
import { patchDesignerStorePath } from '../bindingPreviewHandlers';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { buildPreviewDesignerStore } from '../designerPreviewResolvers';
import type { ApiFormField } from '../apiFieldSchema';
import type { DesignerDocument, DesignerNode } from '../types';

const field = (overrides: Partial<ApiFormField> & { name: string }): ApiFormField => ({
  type: 'string',
  location: 'body',
  required: false,
  ...overrides,
});

const fieldConfig = (
  name: string,
  label: string,
  controlPaletteItemId = 'heroui.input-text',
): AutoFormFieldConfig => ({
  field: field({ name, required: name === 'email' }),
  enabled: true,
  label,
  controlPaletteItemId,
});

const collectNodesByPaletteId = (
  document: DesignerDocument,
  paletteItemId: string,
): DesignerNode[] =>
  Object.values(document.nodes).filter(
    (node) => resolveNodePaletteItemId(node) === paletteItemId,
  );

const collectDescendantIds = (document: DesignerDocument, rootId: string): string[] => {
  const ids: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    ids.push(id);
    const node = document.nodes[id];
    if (node) {
      queue.push(...node.children);
    }
  }
  return ids;
};

const findButtonInPanel = (
  document: DesignerDocument,
  panel: DesignerNode,
  text: string,
): DesignerNode | undefined => {
  for (const nodeId of collectDescendantIds(document, panel.id)) {
    const node = document.nodes[nodeId];
    if (!node) {
      continue;
    }
    if (
      (resolveNodePaletteItemId(node) === 'heroui.button-solid'
        || resolveNodePaletteItemId(node) === 'heroui.button-outline')
      && node.props.text === text
    ) {
      return node;
    }
  }
  return undefined;
};

const findNodeWithProp = (
  document: DesignerDocument,
  paletteItemId: string,
  propKey: string,
  propValue: unknown,
): DesignerNode | undefined =>
  collectNodesByPaletteId(document, paletteItemId).find(
    (node) => node.props[propKey] === propValue,
  );

const buildWizardConfig = (): AutoFormBuildConfig => {
  const dataSource = buildDataSourceFromEndpoint('/api/users', {
    fields: ['id', 'email', 'full_name', 'phone'],
    primaryKey: 'id',
    method: 'POST',
  });

  return {
    title: 'Create User',
    includeTitle: true,
    dataSource,
    scenario: 'wizard',
    fields: [
      fieldConfig('email', 'Email'),
      fieldConfig('full_name', 'Full Name'),
      fieldConfig('phone', 'Phone'),
    ],
    wizardSteps: [
      { title: 'Account', fields: [fieldConfig('email', 'Email')] },
      { title: 'Profile', fields: [fieldConfig('full_name', 'Full Name')] },
      { title: 'Contact', fields: [fieldConfig('phone', 'Phone')] },
    ],
    submitLabel: 'Create User',
    successBehaviors: ['toast', 'refresh'],
    layout: 'single',
  };
};

describe('Auto Form wizard scenario (Phase 30)', () => {
  it('buildAutoFormSeeds produces stepper, visibility containers, and nav buttons', () => {
    const seeds = buildAutoFormSeeds(buildWizardConfig());
    expect(seeds).toHaveLength(1);
    const formSeed = seeds[0]!;
    expect(formSeed.paletteItemId).toBe('html.form');

    const childPaletteIds = (formSeed.children ?? []).map((child) => child.paletteItemId);
    expect(childPaletteIds).toContain('content.stepper');
    expect(childPaletteIds.filter((id) => id === 'logic.visibility-container')).toHaveLength(3);
    expect(childPaletteIds).not.toContain('heroui.button-solid');

    const stepperSeed = (formSeed.children ?? []).find((c) => c.paletteItemId === 'content.stepper');
    expect(stepperSeed?.props?.steps).toBe('Account,Profile,Contact');
    expect(stepperSeed?.binding?.['store:wizardStep.current']).toBeTruthy();

    const stepPanels = (formSeed.children ?? []).filter((c) => c.paletteItemId === 'logic.visibility-container');
    expect(stepPanels[0]?.props?.visibleCondition).toBe('store.wizardStep.current === 0');
    expect(stepPanels[1]?.props?.visibleCondition).toBe('store.wizardStep.current === 1');
    expect(stepPanels[2]?.props?.visibleCondition).toBe('store.wizardStep.current === 2');

    const lastPanel = stepPanels[2]!;
    const navButtons = lastPanel.children?.[1]?.children ?? [];
    const buttonTexts = navButtons.map((btn) => btn.props?.text);
    expect(buttonTexts).toContain('Previous');
    expect(buttonTexts).toContain('Create User');
    expect(buttonTexts).not.toContain('Next');
  });

  it('buildAutoFormDocument registers wizardStep store segment and wires region submit', () => {
    const result = buildAutoFormDocument(buildWizardConfig());

    expect(result.bindingDefinitions.storeSegments.wizardStep).toEqual({
      id: 'wizardStep',
      initialValue: { current: 0 },
      persist: 'none',
    });

    const stepperNodes = collectNodesByPaletteId(result.document, 'content.stepper');
    expect(stepperNodes).toHaveLength(1);
    expect(stepperNodes[0]?.binding?.['store:wizardStep.current']).toMatchObject({
      sourceType: 'store',
      targetProp: 'activeStep',
    });

    const visibilityContainers = collectNodesByPaletteId(result.document, 'logic.visibility-container');
    expect(visibilityContainers).toHaveLength(3);

    const submitButton = findNodeWithProp(result.document, 'heroui.button-solid', 'text', 'Create User');
    expect(submitButton).toBeTruthy();
    expect(submitButton?.binding?.['event:onClick']?.regionSubmit).toBe(true);

    const formNodes = collectNodesByPaletteId(result.document, 'html.form');
    expect(formNodes).toHaveLength(1);
    const submitPlan = resolveRegionSubmitPlanForEvent(
      result.document,
      submitButton!.id,
      result.bindingDefinitions,
    );
    expect(submitPlan).not.toBeNull();
    expect(submitPlan!.fieldMappings.map((mapping) => mapping.column)).toEqual(
      expect.arrayContaining(['email', 'full_name', 'phone']),
    );
  });

  it('exports TSX with store-backed stepper and visibility conditions', async () => {
    const result = buildAutoFormDocument(buildWizardConfig());
    const tsx = generateDesignerTsx(result.document, result.bindingDefinitions);
    await assertValidTsxSyntax('wizard form export', tsx);

    expect(tsx).toContain('DesignerUniversalStepper');
    expect(tsx).toContain('designerStore?.wizardStep?.current');
    expect(tsx).toContain('evaluateDesignerCondition');
    expect(tsx).toContain('useDesignerStore');
    expect(WIZARD_STEP_STORE_SEGMENT.initialValue).toEqual({ current: 0 });
  });

  it('non-wizard create scenario is unchanged (no stepper or visibility containers)', () => {
    const dataSource = buildDataSourceFromEndpoint('/api/users', {
      fields: ['id', 'email'],
      primaryKey: 'id',
      method: 'POST',
    });
    const result = buildAutoFormDocument({
      title: 'Create',
      includeTitle: false,
      dataSource,
      scenario: 'create',
      fields: [fieldConfig('email', 'Email')],
      submitLabel: 'Create',
      layout: 'single',
    });

    expect(result.bindingDefinitions.storeSegments.wizardStep).toBeUndefined();
    expect(collectNodesByPaletteId(result.document, 'content.stepper')).toHaveLength(0);
    expect(collectNodesByPaletteId(result.document, 'logic.visibility-container')).toHaveLength(0);
    expect(findNodeWithProp(result.document, 'heroui.button-solid', 'text', 'Create')).toBeTruthy();
  });

  it('runtime preview shows first step only; re-render with step=1 shows second step', () => {
    const result = buildAutoFormDocument(buildWizardConfig());
    const designerStore = buildPreviewDesignerStore(result.bindingDefinitions);

    const { container, rerender, unmount } = render(
      <MemoryRouter>
        {renderDesignerDocumentPreview(result.document, {
          bindingDefinitions: result.bindingDefinitions,
          interactive: true,
          designerStore,
        })}
      </MemoryRouter>,
    );

    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.queryByText('Full Name')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create User' })).toBeNull();
    expect(container.querySelector('ol')).toBeTruthy();

    const updatedStore = patchDesignerStorePath(designerStore, 'wizardStep.current', 1);
    rerender(
      <MemoryRouter>
        {renderDesignerDocumentPreview(result.document, {
          bindingDefinitions: result.bindingDefinitions,
          interactive: true,
          designerStore: updatedStore,
        })}
      </MemoryRouter>,
    );

    expect(screen.getByText('Full Name')).toBeTruthy();
    expect(screen.queryByText('Email')).toBeNull();
    unmount();
  });

  it('content.stepper activeStep tracks wizardStep.current in preview store', () => {
    const result = buildAutoFormDocument(buildWizardConfig());
    const designerStore = buildPreviewDesignerStore(result.bindingDefinitions);

    expect(designerStore.wizardStep).toEqual({ current: 0 });
    expect(
      evaluateDesignerCondition(designerStore, null, {}, 'store.wizardStep.current === 0'),
    ).toBe(true);
    expect(
      evaluateDesignerCondition(
        { ...designerStore, wizardStep: { current: 1 } },
        null,
        {},
        'store.wizardStep.current === 1',
      ),
    ).toBe(true);

    const { container, rerender } = render(
      <MemoryRouter>
        {renderDesignerDocumentPreview(result.document, {
          bindingDefinitions: result.bindingDefinitions,
          interactive: true,
          designerStore,
        })}
      </MemoryRouter>,
    );

    expect(container.querySelectorAll('ol li span.font-medium.text-slate-900')).toHaveLength(1);

    rerender(
      <MemoryRouter>
        {renderDesignerDocumentPreview(result.document, {
          bindingDefinitions: result.bindingDefinitions,
          interactive: true,
          designerStore: { ...designerStore, wizardStep: { current: 1 } },
        })}
      </MemoryRouter>,
    );

    const activeLabels = container.querySelectorAll('ol li span.font-medium.text-slate-900');
    expect(activeLabels.length).toBeGreaterThanOrEqual(1);
    expect(Array.from(activeLabels).some((el) => el.textContent === 'Profile')).toBe(true);
  });

  it('setValue Next action increments wizardStep.current in store', async () => {
    const result = buildAutoFormDocument(buildWizardConfig());
    const firstStepPanel = findNodeWithProp(
      result.document,
      'logic.visibility-container',
      'visibleCondition',
      'store.wizardStep.current === 0',
    );
    expect(firstStepPanel).toBeTruthy();

    const nextButton = findButtonInPanel(result.document, firstStepPanel!, 'Next');
    expect(nextButton).toBeTruthy();

    const actions = nextButton!.binding?.['event:onClick']?.trueActions ?? [];
    expect(actions).toHaveLength(1);
    expect(actions[0]?.type).toBe('setValue');
    expect(actions[0]?.storePath).toBe('wizardStep.current');

    const designerStore: Record<string, unknown> = { wizardStep: { current: 0 } };
    const patchStore = vi.fn((path: string, value: unknown) => {
      const segments = path.split('.');
      let cursor: Record<string, unknown> = designerStore;
      for (let index = 0; index < segments.length - 1; index += 1) {
        cursor = cursor[segments[index]!] as Record<string, unknown>;
      }
      cursor[segments[segments.length - 1]!] = value;
    });

    await executeDynamicActions(
      actions as Parameters<typeof executeDynamicActions>[0],
      {
        designerStore,
        patchStore,
      },
    );

    expect(patchStore).toHaveBeenCalledWith('wizardStep.current', 1);
  });

  it('submit button only exists on the last wizard step panel', () => {
    const result = buildAutoFormDocument(buildWizardConfig());
    const submitButtons = collectNodesByPaletteId(result.document, 'heroui.button-solid')
      .filter((node) => node.props.text === 'Create User');
    expect(submitButtons).toHaveLength(1);

    const lastPanel = findNodeWithProp(
      result.document,
      'logic.visibility-container',
      'visibleCondition',
      'store.wizardStep.current === 2',
    );
    expect(lastPanel).toBeTruthy();
    const descendantIds = new Set<string>();
    const queue = [...(lastPanel?.children ?? [])];
    while (queue.length > 0) {
      const id = queue.shift()!;
      descendantIds.add(id);
      const node = result.document.nodes[id];
      if (node) {
        queue.push(...node.children);
      }
    }
    expect(descendantIds.has(submitButtons[0]!.id)).toBe(true);
  });
});
