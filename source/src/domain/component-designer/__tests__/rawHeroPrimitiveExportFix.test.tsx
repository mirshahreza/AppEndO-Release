/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit item 29): Export for `heroui.input-text` /
 * `heroui.number-input` / `heroui.textarea` imported the raw `@heroui/react`
 * primitives (`Input` / `TextArea`) instead of the project wrappers
 * (`UiInput` / `UiTextarea`). Those primitives do not accept Designer props
 * (`label` / `description` / `isInvalid` / `errorMessage` / adornments / …),
 * and because catalog `defaultProps` always set `size: 'sm'`, every exported
 * document containing these three common fields failed TypeScript
 * (`size` is a number on the HTML input attribute, not `'sm'`).
 * Fixed in `tsxComponentRegistry.ts` + `tsxNodeRenderer.ts` (+ `UiInput` /
 * `UiTextarea` contract in `HeroFieldControls.tsx` for label/min/max/step/maxRows):
 * Export now emits the same wrappers Preview/Canvas already use.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import type { DesignerState } from '../types';
import { cleanup, render } from '@testing-library/react';
import * as React from 'react';

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const setProp = (state: DesignerState, nodeId: string, key: string, value: unknown): DesignerState =>
  designerReducer(state, { type: 'set-node-prop', nodeId, key, value });

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

const typecheckGeneratedSnippet = (source: string): { ok: boolean; diagnostics: string } => {
  // Keep the probe inside the repo so `tsc` resolves `react` / local `@/` paths via
  // the project's node_modules (tmpdir tsconfigs cannot see them).
  const tmpDir = fs.mkdtempSync(path.join(PROJECT_ROOT, '_tmp_raw_hero_export_fix_'));
  const entryPath = path.join(tmpDir, 'exported-fields.tsx');
  const tsconfigPath = path.join(tmpDir, 'tsconfig.json');

  fs.writeFileSync(entryPath, source, 'utf8');
  fs.writeFileSync(
    tsconfigPath,
    JSON.stringify(
      {
        extends: path.relative(tmpDir, path.join(PROJECT_ROOT, 'tsconfig.json')).replace(/\\/g, '/'),
        compilerOptions: {
          // Match package-runtime alias resolution: `@/` → `src/`.
          baseUrl: path.relative(tmpDir, PROJECT_ROOT).replace(/\\/g, '/') || '.',
          paths: {
            '@/*': ['src/*'],
          },
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
    // status 0 = clean. Non-zero is OK only when every error is outside our generated entry
    // (preexisting noise in transitive project sources pulled in by UiInput/UiTextarea).
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

describe('raw HeroUI primitive export fix (parity audit item 29)', () => {
  afterEach(() => cleanup());

  it('export: imports UiInput/UiTextarea from HeroFieldControls, never raw Input/TextArea', () => {
    let state = createInitialDesignerState();
    state = insertItem(state, 'heroui.input-text');
    const inputId = lastChildId(state);
    state = insertItem(state, 'heroui.number-input');
    const numberId = lastChildId(state);
    state = insertItem(state, 'heroui.textarea');
    const textareaId = lastChildId(state);

    state = setProp(state, inputId, 'label', 'Email');
    state = setProp(state, inputId, 'isRequired', true);
    state = setProp(state, inputId, 'isInvalid', true);
    state = setProp(state, inputId, 'errorMessage', 'Required');
    state = setProp(state, inputId, 'startContent', '@');
    state = setProp(state, inputId, 'pattern', '^[A-Za-z]+$');
    state = setProp(state, inputId, 'minLength', 2);
    state = setProp(state, inputId, 'maxLength', 40);
    state = setProp(state, inputId, 'description', 'Work email');

    state = setProp(state, numberId, 'label', 'Quantity');
    state = setProp(state, numberId, 'min', '0');
    state = setProp(state, numberId, 'max', '99');
    state = setProp(state, numberId, 'step', '1');

    state = setProp(state, textareaId, 'label', 'Notes');
    state = setProp(state, textareaId, 'minRows', 4);
    state = setProp(state, textareaId, 'description', 'Optional notes');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax('input family with validation/adornment', tsx);

    expect(tsx).toMatch(/import\s*\{[^}]*\bUiInput\b[^}]*\}\s*from\s*['"]@\/shared\/ui\/HeroFieldControls['"]/);
    expect(tsx).toMatch(/import\s*\{[^}]*\bUiTextarea\b[^}]*\}\s*from\s*['"]@\/shared\/ui\/HeroFieldControls['"]/);
    expect(tsx).not.toMatch(/import\s*\{[^}]*\bInput\b[^}]*\}\s*from\s*['"]@heroui\/react['"]/);
    expect(tsx).not.toMatch(/import\s*\{[^}]*\bTextArea\b[^}]*\}\s*from\s*['"]@heroui\/react['"]/);

    expect(tsx).toMatch(/<UiInput\b/);
    expect(tsx).toMatch(/<UiTextarea\b/);
    expect(tsx).not.toMatch(/<Input\b/);
    expect(tsx).not.toMatch(/<TextArea\b/);

    // size stays the Designer token string — legal on UiInput, illegal as HTML size on raw Input.
    expect(tsx).toMatch(/<UiInput\b[^>]*\ssize="sm"/);
    expect(tsx).toMatch(/label="Email"/);
    expect(tsx).toMatch(/errorMessage="Required"/);
    expect(tsx).toMatch(/startContent="@"/);
    expect(tsx).toMatch(/\bmin=\{0\}/);
    expect(tsx).toMatch(/\bmax=\{99\}/);
    expect(tsx).toMatch(/\bstep=\{1\}/);
    expect(tsx).toMatch(/label="Notes"/);
  });

  it('export: real tsc --noEmit accepts the emitted UiInput/UiTextarea prop contract (including size="sm")', () => {
    let state = createInitialDesignerState();
    state = insertItem(state, 'heroui.input-text');
    const inputId = lastChildId(state);
    state = insertItem(state, 'heroui.number-input');
    const numberId = lastChildId(state);
    state = insertItem(state, 'heroui.textarea');
    const textareaId = lastChildId(state);

    state = setProp(state, inputId, 'label', 'Email');
    state = setProp(state, inputId, 'isRequired', true);
    state = setProp(state, inputId, 'isInvalid', true);
    state = setProp(state, inputId, 'errorMessage', 'Required');
    state = setProp(state, inputId, 'startContent', '@');
    state = setProp(state, inputId, 'endContent', '.com');
    state = setProp(state, inputId, 'pattern', '^[A-Za-z]+$');
    state = setProp(state, inputId, 'minLength', 2);
    state = setProp(state, inputId, 'maxLength', 40);
    state = setProp(state, inputId, 'description', 'Work email');

    state = setProp(state, numberId, 'min', '0');
    state = setProp(state, numberId, 'max', '99');
    state = setProp(state, numberId, 'step', '1');

    state = setProp(state, textareaId, 'label', 'Notes');
    state = setProp(state, textareaId, 'minRows', 4);
    state = setProp(state, textareaId, 'maxRows', 8);

    const fullTsx = generateDesignerTsx(state.document, state.bindingDefinitions);

    // Isolate the three field tags from the full export (avoids unrelated generated helpers)
    // while preserving the exact attribute shapes codegen emitted.
    const uiInputMatches = fullTsx.match(/<UiInput\b[^>]*\/>/g) ?? [];
    const uiTextareaMatches = fullTsx.match(/<UiTextarea\b[^>]*\/>/g) ?? [];
    expect(uiInputMatches.length).toBeGreaterThanOrEqual(2);
    expect(uiTextareaMatches.length).toBeGreaterThanOrEqual(1);

    const snippet = `
import * as React from 'react';
import { UiInput, UiTextarea } from '@/shared/ui/HeroFieldControls';

export default function ExportedFields() {
  return (
    <>
      ${uiInputMatches.join('\n      ')}
      ${uiTextareaMatches.join('\n      ')}
    </>
  );
}
`.trim();

    const check = typecheckGeneratedSnippet(snippet);
    expect(check.ok, check.diagnostics).toBe(true);
  });

  it('preview: visible label renders for input-text / textarea (parity with Export wrappers)', () => {
    let state = createInitialDesignerState();
    state = insertItem(state, 'heroui.input-text');
    const inputId = lastChildId(state);
    state = setProp(state, inputId, 'label', 'Email');

    state = insertItem(state, 'heroui.textarea');
    const textareaId = lastChildId(state);
    state = setProp(state, textareaId, 'label', 'Notes');

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Email');
    expect(container.textContent).toContain('Notes');
  });
});
