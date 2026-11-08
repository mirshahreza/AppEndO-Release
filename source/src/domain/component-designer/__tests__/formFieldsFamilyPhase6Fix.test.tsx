/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit items 33, 41–45, 61–62, 64): shared Designer form-field family
 * (html-editor / code-editor / mask-input / calculator / color-control / textarea /
 * field-container) had stale onBlur validation, missing html-editor name + blur wiring,
 * invalid Export attribute leaks that broke `tsc`, double-JSON-encoded color `value`,
 * dead field-container label bindings, zero textarea live validation, and calculator
 * min/max that only applied via keypad `=`.
 * Fixed in designerFormFieldRuntime.ts, DesignerRichTextEditor.tsx, DesignerFormFields.tsx,
 * tsxPhase2Palette.ts, runtimeRenderer.tsx, tsxNodeRenderer.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { createStoreReadBindingDefinition } from '../bindingStoreEngine';
import { DesignerRichTextEditor } from '../../../shared/ui/DesignerRichTextEditor';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: state.document.rootNodeId });

const lastChildId = (state: DesignerState): string => {
  const parent = state.document.nodes[state.document.rootNodeId];
  return parent.children[parent.children.length - 1] as string;
};

const setProp = (state: DesignerState, nodeId: string, key: string, value: unknown): DesignerState =>
  designerReducer(state, { type: 'set-node-prop', nodeId, key, value });

const bindStoreProp = (state: DesignerState, nodeId: string, prop: string, storePath: string): DesignerState => {
  const binding = createStoreReadBindingDefinition(prop, storePath);
  return designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: binding.bindingKey,
    definition: binding.definition,
  });
};

const renderInteractive = (
  state: DesignerState,
  onPreviewFieldValidation: (nodeId: string, message: string | null) => void,
) => render(
  <>
    {renderDesignerDocumentPreview(state.document, { interactive: true, onPreviewFieldValidation })}
  </>,
);

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

const typecheckGeneratedSnippet = (source: string): { ok: boolean; diagnostics: string } => {
  const tmpDir = fs.mkdtempSync(path.join(PROJECT_ROOT, '_tmp_phase6_form_fields_export_'));
  const entryPath = path.join(tmpDir, 'exported-fields.tsx');
  const tsconfigPath = path.join(tmpDir, 'tsconfig.json');

  fs.writeFileSync(entryPath, source, 'utf8');
  fs.writeFileSync(
    tsconfigPath,
    JSON.stringify(
      {
        extends: path.relative(tmpDir, path.join(PROJECT_ROOT, 'tsconfig.json')).replace(/\\/g, '/'),
        compilerOptions: {
          baseUrl: path.relative(tmpDir, PROJECT_ROOT).replace(/\\/g, '/') || '.',
          paths: { '@/*': ['src/*'] },
          noEmit: true,
          skipLibCheck: true,
        },
        include: ['./exported-fields.tsx'],
        exclude: ['node_modules'],
      },
      null,
      2,
    ),
    'utf8',
  );

  try {
    const tscCli = path.join(PROJECT_ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
    const result = spawnSync(process.execPath, [tscCli, '--noEmit', '-p', tsconfigPath], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      shell: false,
      timeout: 120_000,
    });
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
    if (result.error) {
      return { ok: false, diagnostics: `tsc failed to launch: ${result.error.message}` };
    }
    const entryDiagnostics = output
      .split(/\r?\n/)
      .filter((line) => line.includes('exported-fields.tsx') && /\berror TS\d+/.test(line))
      .join('\n');
    const hasAnyTsError = /\berror TS\d+/.test(output);
    const ok = entryDiagnostics.length === 0 && (result.status === 0 || hasAnyTsError);
    return {
      ok,
      diagnostics: entryDiagnostics
        || (ok ? '' : `tsc status=${String(result.status)}\n${output.slice(0, 4000)}`),
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};

describe('form fields family phase 6 fixes (parity audit items 33/41-45/61-62/64)', () => {
  afterEach(() => cleanup());

  it('item 42/61: color-control validates the live typed value on blur, not the stale empty prop', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.color-control');
    const nodeId = lastChildId(state);
    state = setProp(state, nodeId, 'isRequired', true);
    state = setProp(state, nodeId, 'value', '');

    const calls: Array<[string, string | null]> = [];
    const { container } = renderInteractive(state, (id, message) => calls.push([id, message]));

    const input = container.querySelector('input');
    expect(input).toBeTruthy();
    fireEvent.change(input!, { target: { value: '#112233' } });
    fireEvent.blur(input!);

    expect(calls.some(([id, message]) => id === nodeId && message === 'This field is required.')).toBe(false);
    expect(calls.some(([id, message]) => id === nodeId && message === null)).toBe(true);
  });

  it('item 42/61: calculator validates the live typed value on blur, not the stale empty prop', () => {
    let state = insertItem(createInitialDesignerState(), 'form.calculator');
    const nodeId = lastChildId(state);
    state = setProp(state, nodeId, 'isRequired', true);
    state = setProp(state, nodeId, 'value', '');
    state = setProp(state, nodeId, 'showKeypad', false);

    const calls: Array<[string, string | null]> = [];
    const { container } = renderInteractive(state, (id, message) => calls.push([id, message]));

    const input = container.querySelector('input');
    expect(input).toBeTruthy();
    fireEvent.change(input!, { target: { value: '42' } });
    fireEvent.blur(input!);

    expect(calls.some(([id, message]) => id === nodeId && message === 'This field is required.')).toBe(false);
  });

  it('item 41: textarea fires live validation on blur via sharedFieldEventProps', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.textarea');
    const nodeId = lastChildId(state);
    state = setProp(state, nodeId, 'isRequired', true);
    state = setProp(state, nodeId, 'value', '');

    const calls: Array<[string, string | null]> = [];
    const { container } = renderInteractive(state, (id, message) => calls.push([id, message]));

    const textarea = container.querySelector('textarea');
    expect(textarea).toBeTruthy();
    fireEvent.blur(textarea!);

    expect(calls.some(([id, message]) => id === nodeId && message === 'This field is required.')).toBe(true);

    fireEvent.change(textarea!, { target: { value: 'hello' } });
    fireEvent.blur(textarea!);
    expect(calls.some(([id, message]) => id === nodeId && message === null)).toBe(true);
  });

  it('item 33: html-editor emits a named hidden input and wires onBlur', async () => {
    let state = insertItem(createInitialDesignerState(), 'form.html-editor');
    const nodeId = lastChildId(state);
    state = setProp(state, nodeId, 'isRequired', true);
    state = setProp(state, nodeId, 'value', '');
    state = setProp(state, nodeId, 'name', 'bodyHtml');

    const { container } = renderInteractive(state, () => undefined);

    await waitFor(() => {
      expect(container.querySelector('[data-designer-rich-text-editor="true"]')).toBeTruthy();
    });

    const hidden = container.querySelector('input[type="hidden"][name="bodyHtml"]') as HTMLInputElement | null;
    expect(hidden).toBeTruthy();

    // TipTap focus in jsdom is unreliable for integration blur→validation; prove the component
    // actually forwards onBlur (the shared base already supplies the validation handler).
    const onBlur = vi.fn();
    const { container: unitContainer } = render(
      <DesignerRichTextEditor name="unitHtml" isRequired onBlur={onBlur} />,
    );
    await waitFor(() => {
      expect(unitContainer.querySelector('[data-designer-rich-text-editor="true"]')).toBeTruthy();
    });
    fireEvent.focusOut(unitContainer.querySelector('[data-designer-rich-text-editor="true"]')!);
    expect(onBlur).toHaveBeenCalled();
  });

  it('item 33: html-editor content round-trips through a real <form> FormData submit', async () => {
    // Empirical end-to-end check (not just presence of the hidden input): put the component in a
    // real <form>, change its HTML content, and read the value back out via `new FormData(form)` —
    // exactly how Region-bound forms collect field values in production
    // (readRegionFormFieldValueFromContainer / native form submit).
    const Harness: React.FC<{ value: string }> = ({ value }) => (
      <form data-testid="host-form">
        <DesignerRichTextEditor name="test" value={value} />
      </form>
    );

    const { container, rerender } = render(<Harness value="<p>first</p>" />);
    await waitFor(() => {
      expect(container.querySelector('[data-designer-rich-text-editor="true"]')).toBeTruthy();
    });

    const form = container.querySelector('form[data-testid="host-form"]') as HTMLFormElement;
    expect(form).toBeTruthy();

    let hidden = form.querySelector('input[type="hidden"][name="test"]') as HTMLInputElement;
    expect(hidden).toBeTruthy();
    expect(hidden.value).toContain('first');
    expect(new FormData(form).get('test')).toContain('first');

    // Simulate the field's content changing (the same `setHtmlValue` path TipTap's onUpdate
    // drives on every keystroke) and confirm the hidden input — and therefore FormData — tracks it.
    rerender(<Harness value="<p>typed content</p>" />);
    await waitFor(() => {
      hidden = form.querySelector('input[type="hidden"][name="test"]') as HTMLInputElement;
      expect(hidden.value).toContain('typed content');
    });

    const submittedValue = new FormData(form).get('test');
    expect(submittedValue).toContain('typed content');
    expect(submittedValue).not.toContain('first');
  });

  it('item 44: color-control Export encodes default value once (not value={"\\"#3B82F6\\""})', () => {
    const state = insertItem(createInitialDesignerState(), 'heroui.color-control');
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('color-control default value', tsx);

    expect(tsx).toContain('value="#3B82F6"');
    expect(tsx).not.toMatch(/value=\{\s*"\\"#3B82F6\\""\s*\}/);
    expect(tsx).not.toContain('value={"\\"');
  });

  it('items 43/62: Export of color/code/mask/calculator with validation+adornment props typechecks', () => {
    let state = createInitialDesignerState();
    const items = [
      'heroui.color-control',
      'form.code-editor',
      'form.mask-input',
      'form.calculator',
      'form.html-editor',
    ] as const;

    for (const itemId of items) {
      state = insertItem(state, itemId);
      const nodeId = lastChildId(state);
      state = setProp(state, nodeId, 'pattern', '^[A-Za-z]+$');
      state = setProp(state, nodeId, 'minLength', 2);
      state = setProp(state, nodeId, 'maxLength', 40);
      state = setProp(state, nodeId, 'validationRule', 'value != null');
      state = setProp(state, nodeId, 'validationErrorMessage', 'bad');
      state = setProp(state, nodeId, 'startContent', '@');
      state = setProp(state, nodeId, 'endContent', 'x');
      state = setProp(state, nodeId, 'isClearable', true);
      state = setProp(state, nodeId, 'autoFocus', true);
      state = setProp(state, nodeId, 'size', 'sm');
      state = setProp(state, nodeId, 'inputMode', 'text');
    }

    const fullTsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('form-field unsupported export attrs', fullTsx);

    for (const leak of [
      'pattern=',
      'minLength=',
      'maxLength=',
      'validationRule=',
      'validationErrorMessage=',
      'startContent=',
      'endContent=',
      'isClearable',
      'autoFocus',
      'inputMode=',
    ]) {
      expect(fullTsx).not.toContain(leak);
    }
    expect(fullTsx).not.toMatch(/<(DesignerColorEditorField|DesignerCodeEditorField|DesignerMaskInputField|DesignerCalculatorField|DesignerHtmlEditorField)\b[^>]*\bsize=/);

    const fieldTags = [
      ...(fullTsx.match(/<DesignerColorEditorField\b[\s\S]*?\/>/g) ?? []),
      ...(fullTsx.match(/<DesignerCodeEditorField\b[\s\S]*?\/>/g) ?? []),
      ...(fullTsx.match(/<DesignerMaskInputField\b[\s\S]*?\/>/g) ?? []),
      ...(fullTsx.match(/<DesignerCalculatorField\b[\s\S]*?\/>/g) ?? []),
      ...(fullTsx.match(/<DesignerHtmlEditorField\b[\s\S]*?\/>/g) ?? []),
    ];
    expect(fieldTags.length).toBe(5);

    const snippet = `
import * as React from 'react';
import {
  DesignerCalculatorField,
  DesignerCodeEditorField,
  DesignerColorEditorField,
  DesignerHtmlEditorField,
} from '@/shared/ui/DesignerFormFields';
import { DesignerMaskInputField } from '@/shared/ui/DesignerMaskInputField';

export default function ExportedFields() {
  return (
    <>
      ${fieldTags.join('\n      ')}
    </>
  );
}
`.trim();

    const check = typecheckGeneratedSnippet(snippet);
    expect(check.ok, check.diagnostics).toBe(true);
  });

  it('item 45: field-container label Store binding resolves in Preview and Export', () => {
    let state = insertItem(createInitialDesignerState(), 'heroui.field-container');
    const nodeId = lastChildId(state);
    state = setProp(state, nodeId, 'label', 'Static legend');
    state = bindStoreProp(state, nodeId, 'label', 'form.sectionTitle');

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          designerStore: { form: { sectionTitle: 'Live section title' } },
        })}
      </>,
    );
    expect(container.textContent).toContain('Live section title');
    expect(container.textContent).not.toContain('Static legend');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('field-container label binding', tsx);
    expect(tsx).toMatch(/<legend[^>]*>\{designerStore\?\.form\?\.sectionTitle/);
    expect(tsx).not.toMatch(/<fieldset[^>]*\slabel=\{/);
  });

  it('item 64: calculator clamps min/max on direct typing (not only keypad =)', () => {
    let state = insertItem(createInitialDesignerState(), 'form.calculator');
    const nodeId = lastChildId(state);
    state = setProp(state, nodeId, 'min', '0');
    state = setProp(state, nodeId, 'max', '10');
    state = setProp(state, nodeId, 'showKeypad', false);
    state = setProp(state, nodeId, 'value', '');

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, { interactive: true })}
      </>,
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).toBeTruthy();

    fireEvent.change(input, { target: { value: '25' } });
    expect(input.value).toBe('10');

    fireEvent.change(input, { target: { value: '-3' } });
    expect(input.value).toBe('0');
  });
});
