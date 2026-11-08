/**
 * Bug found (Auto Form Builder phase 18): OpenAPI `pattern`/`minLength`/`maxLength`/
 * `minimum`/`maximum` were never extracted into `ApiFormField` or applied via
 * `buildControlProps`, even though Canvas/Preview/Export already honor those props on
 * text/number controls. Control coverage also stopped at 12 of ~19 real form widgets —
 * file-upload/checkbox-group/radio-group/slider/autocomplete/entity-picker/date-range
 * were missing from the wizard palette.
 * Fixed in `apiFieldSchema.ts` + `apiFieldToControl.ts`: extract validation keys from
 * OpenAPI, map them onto control props, expand the palette, and auto-suggest
 * `html.file-upload` for binary/byte/file-named fields (other new controls stay
 * explicit alternatives so existing defaults like boolean→switch are unchanged).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup } from '@testing-library/react';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { generateDesignerTsx } from '../codegen';
import {
  parseApiEndpointFromOpenApi,
  type ApiFormField,
} from '../apiFieldSchema';
import {
  AUTO_FORM_CONTROL_PALETTE_ITEM_IDS,
  alternativeControlsForField,
  buildControlProps,
  isLikelyFileUploadField,
  mapApiFieldToControl,
  suggestControlForField,
  valuePropForControl,
} from '../apiFieldToControl';
import {
  buildAutoFormDocument,
  type AutoFormFieldConfig,
} from '../autoFormTemplateBuilder';
import { buildDataSourceFromEndpoint } from '../bindingResourceModel';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../propRegistry';

afterEach(() => cleanup());

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

const field = (overrides: Partial<ApiFormField> & { name: string }): ApiFormField => ({
  type: 'string',
  location: 'body',
  required: false,
  ...overrides,
});

const VALIDATION_SPEC = {
  openapi: '3.1.2',
  paths: {
    '/api/profiles': {
      post: {
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'age', 'score'],
                properties: {
                  username: {
                    type: 'string',
                    pattern: '^[a-z][a-z0-9_]{2,31}$',
                    minLength: 3,
                    maxLength: 32,
                  },
                  age: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 120,
                  },
                  score: {
                    type: 'number',
                    minimum: 1,
                    maximum: 10,
                  },
                  bio: {
                    type: 'string',
                    maxLength: 500,
                  },
                  avatar: {
                    type: 'string',
                    format: 'binary',
                  },
                  roles: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: ['admin', 'editor', 'viewer'],
                    },
                  },
                  plan: {
                    type: 'string',
                    enum: ['free', 'pro'],
                  },
                  customer_id: {
                    type: 'string',
                  },
                  attachment: {
                    type: 'string',
                    format: 'byte',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const typecheckGeneratedSnippet = (source: string): { ok: boolean; diagnostics: string } => {
  const tmpDir = fs.mkdtempSync(path.join(PROJECT_ROOT, '_tmp_phase18_auto_form_export_'));
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

const buildFieldConfigs = (fields: ApiFormField[], controlOverrides?: Record<string, string>): AutoFormFieldConfig[] =>
  fields.map((entry) => {
    const control = mapApiFieldToControl(entry);
    return {
      field: entry,
      enabled: true,
      label: entry.name,
      controlPaletteItemId: controlOverrides?.[entry.name] ?? control.paletteItemId,
    };
  });

describe('autoFormFieldCoveragePhase18Fix — OpenAPI validation extraction', () => {
  it('extracts pattern/minLength/maxLength/minimum/maximum from OpenAPI properties', () => {
    const parsed = parseApiEndpointFromOpenApi(VALIDATION_SPEC, { method: 'POST' });
    expect(parsed).not.toBeNull();
    const byName = new Map(parsed!.fields.map((entry) => [entry.name, entry]));

    expect(byName.get('username')).toMatchObject({
      pattern: '^[a-z][a-z0-9_]{2,31}$',
      minLength: 3,
      maxLength: 32,
    });
    expect(byName.get('age')).toMatchObject({ type: 'integer', minimum: 0, maximum: 120 });
    expect(byName.get('score')).toMatchObject({ type: 'number', minimum: 1, maximum: 10 });
    expect(byName.get('bio')).toMatchObject({ maxLength: 500 });
    expect(byName.get('avatar')?.format).toBe('binary');
    expect(byName.get('roles')?.enum).toEqual(['admin', 'editor', 'viewer']);
  });

  it('buildControlProps applies validation onto text/number controls', () => {
    const username = field({
      name: 'username',
      pattern: '^[a-z]+$',
      minLength: 3,
      maxLength: 32,
      required: true,
    });
    const textProps = buildControlProps('heroui.input-text', { field: username, label: 'Username' });
    expect(textProps).toMatchObject({
      pattern: '^[a-z]+$',
      minLength: 3,
      maxLength: 32,
      isRequired: true,
    });

    const bio = field({ name: 'bio', maxLength: 500 });
    const textareaProps = buildControlProps('heroui.textarea', { field: bio, label: 'Bio' });
    expect(textareaProps.maxLength).toBe(500);

    const age = field({ name: 'age', type: 'integer', minimum: 0, maximum: 120 });
    const numberProps = buildControlProps('heroui.number-input', { field: age, label: 'Age' });
    expect(numberProps.min).toBe('0');
    expect(numberProps.max).toBe('120');
    expect(numberProps.step).toBe('1');
  });
});

describe('autoFormFieldCoveragePhase18Fix — control coverage', () => {
  it('expands the wizard palette with the new form controls', () => {
    expect(AUTO_FORM_CONTROL_PALETTE_ITEM_IDS).toEqual(expect.arrayContaining([
      'heroui.autocomplete',
      'heroui.entity-picker',
      'heroui.checkbox-group',
      'heroui.radio-group',
      'heroui.slider',
      'form.date-range',
      'html.file-upload',
    ]));
  });

  it('preserves existing default suggestions (boolean→switch, enum→select, …)', () => {
    expect(suggestControlForField(field({ name: 'a', type: 'boolean' }))).toBe('heroui.switch');
    expect(suggestControlForField(field({ name: 'a', type: 'integer' }))).toBe('heroui.number-input');
    expect(suggestControlForField(field({ name: 'a', enum: ['x', 'y'] }))).toBe('heroui.select');
    expect(suggestControlForField(field({ name: 'a', format: 'date' }))).toBe('heroui.date-picker');
    expect(suggestControlForField(field({ name: 'a', type: 'array' }))).toBe('heroui.tags-input');
    expect(suggestControlForField(field({ name: 'a', type: 'array', enum: ['x'] }))).toBe('heroui.select');
    expect(suggestControlForField(field({ name: 'a' }))).toBe('heroui.input-text');
    expect(suggestControlForField(field({ name: 'topic_code' }))).toBe('heroui.select');
  });

  it('auto-suggests html.file-upload for binary/byte/file-named fields', () => {
    expect(isLikelyFileUploadField(field({ name: 'avatar', format: 'binary' }))).toBe(true);
    expect(suggestControlForField(field({ name: 'avatar', format: 'binary' }))).toBe('html.file-upload');
    expect(suggestControlForField(field({ name: 'payload', format: 'byte' }))).toBe('html.file-upload');
    expect(suggestControlForField(field({ name: 'resume_file' }))).toBe('html.file-upload');
    expect(suggestControlForField(field({ name: 'user_attachment' }))).toBe('html.file-upload');
  });

  it('offers checkbox-group / radio-group / slider / FK pickers as alternatives (not forced defaults)', () => {
    const roles = field({ name: 'roles', type: 'array', enum: ['admin', 'editor'] });
    expect(suggestControlForField(roles)).toBe('heroui.select');
    expect(alternativeControlsForField(roles)).toContain('heroui.checkbox-group');

    const plan = field({ name: 'plan', enum: ['free', 'pro'] });
    expect(suggestControlForField(plan)).toBe('heroui.select');
    expect(alternativeControlsForField(plan)).toContain('heroui.radio-group');

    const score = field({ name: 'score', type: 'number', minimum: 1, maximum: 10 });
    expect(suggestControlForField(score)).toBe('heroui.number-input');
    expect(alternativeControlsForField(score)).toContain('heroui.slider');

    const customerId = field({ name: 'customer_id' });
    expect(suggestControlForField(customerId)).toBe('heroui.input-text');
    expect(alternativeControlsForField(customerId)).toEqual(
      expect.arrayContaining(['heroui.autocomplete', 'heroui.entity-picker']),
    );
  });

  it('builds correct props + valueProp for each new control', () => {
    const roles = field({ name: 'roles', type: 'array', enum: ['admin', 'editor'] });
    const checkboxProps = buildControlProps('heroui.checkbox-group', { field: roles, label: 'Roles' });
    expect(JSON.parse(checkboxProps.items as string)).toEqual([
      { id: 'admin', textValue: 'Admin' },
      { id: 'editor', textValue: 'Editor' },
    ]);
    expect(valuePropForControl('heroui.checkbox-group')).toBe('isSelected');

    const plan = field({ name: 'plan', enum: ['free', 'pro'] });
    const radioProps = buildControlProps('heroui.radio-group', { field: plan, label: 'Plan' });
    expect(JSON.parse(radioProps.items as string)).toHaveLength(2);
    expect(valuePropForControl('heroui.radio-group')).toBe('isSelected');

    const score = field({ name: 'score', type: 'integer', minimum: 1, maximum: 10 });
    const sliderProps = buildControlProps('heroui.slider', { field: score, label: 'Score' });
    expect(sliderProps).toMatchObject({ min: 1, max: 10, step: 1, ariaLabel: 'Score' });

    const avatar = field({ name: 'avatar', format: 'binary' });
    const fileProps = buildControlProps('html.file-upload', { field: avatar, label: 'Avatar' });
    expect(fileProps.accept).toBe('image/*');
    expect(fileProps.name).toBe('avatar');

    expect(valuePropForControl('form.date-range')).toBe('startValue');
    expect(valuePropForControl('heroui.autocomplete')).toBe('selectedKeys');
    expect(valuePropForControl('heroui.entity-picker')).toBe('selectedKeys');
  });

  it('produces real nodes with the chosen paletteItemId for each new control', () => {
    const fields: ApiFormField[] = [
      field({ name: 'avatar', format: 'binary' }),
      field({ name: 'roles', type: 'array', enum: ['admin', 'editor'] }),
      field({ name: 'plan', enum: ['free', 'pro'] }),
      field({ name: 'score', type: 'integer', minimum: 1, maximum: 10 }),
      field({ name: 'customer_id' }),
      field({ name: 'window', format: 'date' }),
    ];

    const { document } = buildAutoFormDocument({
      title: 'Coverage form',
      includeTitle: false,
      dataSource: buildDataSourceFromEndpoint('/api/profiles', {
        fields: fields.map((entry) => entry.name),
        primaryKey: 'id',
        method: 'POST',
      }),
      scenario: 'create',
      fields: buildFieldConfigs(fields, {
        roles: 'heroui.checkbox-group',
        plan: 'heroui.radio-group',
        score: 'heroui.slider',
        customer_id: 'heroui.entity-picker',
        window: 'form.date-range',
      }),
      layout: 'single',
      submitLabel: 'Save',
      successBehaviors: ['toast'],
    });

    const byName = new Map(
      Object.values(document.nodes)
        .filter((node) => typeof node.props.name === 'string')
        .map((node) => [String(node.props.name), node]),
    );

    expect(byName.get('avatar')?.props[DESIGNER_PALETTE_ITEM_ID_PROP]).toBe('html.file-upload');
    expect(byName.get('roles')?.props[DESIGNER_PALETTE_ITEM_ID_PROP]).toBe('heroui.checkbox-group');
    expect(byName.get('plan')?.props[DESIGNER_PALETTE_ITEM_ID_PROP]).toBe('heroui.radio-group');
    expect(byName.get('score')?.props[DESIGNER_PALETTE_ITEM_ID_PROP]).toBe('heroui.slider');
    expect(byName.get('score')?.props.min).toBe(1);
    expect(byName.get('score')?.props.max).toBe(10);
    expect(byName.get('customer_id')?.props[DESIGNER_PALETTE_ITEM_ID_PROP]).toBe('heroui.entity-picker');
    expect(byName.get('window')?.props[DESIGNER_PALETTE_ITEM_ID_PROP]).toBe('form.date-range');
    expect(byName.get('avatar')?.props.accept).toBe('image/*');
  });
});

describe('autoFormFieldCoveragePhase18Fix — export typecheck for validation props', () => {
  it('generateDesignerTsx + real tsc accepts pattern/minLength/maxLength/min/max from OpenAPI', () => {
    const username = field({
      name: 'username',
      pattern: '^[a-z][a-z0-9_]{2,31}$',
      minLength: 3,
      maxLength: 32,
      required: true,
    });
    const age = field({ name: 'age', type: 'integer', minimum: 0, maximum: 120, required: true });
    const bio = field({ name: 'description', maxLength: 500 });

    const { document, bindingDefinitions } = buildAutoFormDocument({
      title: 'Validated profile',
      includeTitle: false,
      dataSource: buildDataSourceFromEndpoint('/api/profiles', {
        fields: ['username', 'age', 'description'],
        primaryKey: 'id',
        method: 'POST',
      }),
      scenario: 'create',
      fields: buildFieldConfigs([username, age, bio]),
      layout: 'single',
      submitLabel: 'Create',
      successBehaviors: ['toast'],
    });

    const fullTsx = generateDesignerTsx(document, bindingDefinitions);
    assertValidTsxSyntax('auto-form validation props', fullTsx);

    expect(fullTsx).toMatch(/pattern=/);
    expect(fullTsx).toMatch(/maxLength=\{?32\}?/);
    expect(fullTsx).toMatch(/minLength=\{?3\}?/);
    expect(fullTsx).toMatch(/\bmin=\{?0\}?/);
    expect(fullTsx).toMatch(/\bmax=\{?120\}?/);

    const uiInputMatches = fullTsx.match(/<UiInput\b[^>]*\/>/g) ?? [];
    const uiTextareaMatches = fullTsx.match(/<UiTextarea\b[^>]*\/>/g) ?? [];
    expect(uiInputMatches.length).toBeGreaterThanOrEqual(2);
    expect(uiTextareaMatches.length).toBeGreaterThanOrEqual(1);

    const snippet = `
import * as React from 'react';
import { UiInput, UiTextarea } from '@/shared/ui/HeroFieldControls';

// Stub the region binding identifier emitted by auto-form codegen so tsc can
// validate the UiInput/UiTextarea prop contract (pattern/minLength/maxLength/min/max).
const regionData_profiles: {
  username?: string;
  age?: number;
  description?: string;
} | undefined = undefined;

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
});
