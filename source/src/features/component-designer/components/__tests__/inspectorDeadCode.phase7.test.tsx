// @vitest-environment jsdom

/**
 * Phase 7 — Inspector dead-code cleanup locks.
 * Real DOM / module assertions (not props-only).
 */
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DesignerFieldRow } from '../DesignerFieldRow';
import * as DesignerFieldRowModule from '../DesignerFieldRow';
import {
  INSPECTOR_MICRO_LABEL_CLASS,
  InspectorFieldGroup,
  InspectorMicroLabel,
} from '../inspectorFieldPrimitives';

afterEach(() => {
  cleanup();
});

describe('Phase 7 — Inspector dead-code cleanup', () => {
  it('expandedWidths state is gone from InspectorDataGridColumnsField source', () => {
    const source = readFileSync(
      resolve(__dirname, '../InspectorDataGridColumnsField.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/\bexpandedWidths\b/);
    expect(source).toMatch(/\bexpandedColumnIndex\b/);
  });

  it('DesignerFieldRow does not re-export Phase-4 primitives (single source: inspectorFieldPrimitives)', () => {
    expect(DesignerFieldRowModule).toHaveProperty('DesignerFieldRow');
    expect(DesignerFieldRowModule).not.toHaveProperty('InspectorMicroLabel');
    expect(DesignerFieldRowModule).not.toHaveProperty('InspectorFieldGroup');
    expect(DesignerFieldRowModule).not.toHaveProperty('INSPECTOR_MICRO_LABEL_CLASS');
    // Canonical exports remain available from the primitives module.
    expect(typeof InspectorMicroLabel).toBe('function');
    expect(typeof InspectorFieldGroup).toBe('function');
    expect(INSPECTOR_MICRO_LABEL_CLASS).toMatch(/text-\[10px]/);
  });

  it('layout="inline" remains live: real DOM uses horizontal flex (not stack column)', () => {
    const { container } = render(
      <DesignerFieldRow label="Display" layout="inline" align="center">
        <button type="button">Flex</button>
      </DesignerFieldRow>,
    );
    const row = container.querySelector('.designer-field-row');
    expect(row).toBeTruthy();
    const className = row!.className;
    expect(className).toContain('flex');
    expect(className).toContain('gap-2');
    expect(className).not.toContain('flex-col');
    expect(className).toContain('items-center');

    const label = row!.querySelector('label');
    expect(label?.className).toContain('min-w-[96px]');
    expect(label?.className).not.toMatch(/\bw-full\b/);
  });

  it('layout="stack" (default) still renders vertical field chrome', () => {
    const { container } = render(
      <DesignerFieldRow label="Columns">
        <input aria-label="Columns value" />
      </DesignerFieldRow>,
    );
    const row = container.querySelector('.designer-field-row');
    expect(row!.className).toContain('flex-col');
    expect(row!.className).toContain('gap-[2px]');
  });
});
