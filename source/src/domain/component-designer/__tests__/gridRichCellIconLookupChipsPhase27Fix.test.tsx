/**
 * @vitest-environment jsdom
 *
 * Bug found (Users gap U10/U11 — Phase 27): Designer rich cells had no `icon-from-lookup`
 * kind for Base Info / LOV uiHtml icons (person_type / gender), and `chips` only knew
 * ADMIN=indigo / else=slate — missing Users' hash-8 palette, 3-char truncate, tooltip,
 * and overlap. Fixed in designerGridRichCellColumns.ts / designerGridRichCellRuntime.tsx /
 * InspectorGridRichCellFields.tsx / hashChipPalette.ts: new kind + chips display options.
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  defaultRichCellFieldsForKind,
  parseDesignerGridRichCellFields,
  resolveDesignerGridChipClass,
  resolveDesignerGridChipLabel,
  resolveDesignerGridIconFromLookup,
  USERS_PERSON_TYPE_ICON_COLUMN_PRESET,
  USERS_ROLES_CHIPS_COLUMN_PRESET,
} from '../designerGridRichCellColumns';
import { DesignerGridRichCell } from '../designerGridRichCellRuntime';
import { getHashChipClass } from '../../../shared/lib/hashChipPalette';
import {
  parseDesignerDataGridColumns,
  serializeDesignerDataGridColumns,
} from '../designerDataGridColumns';

describe('Phase 27 icon-from-lookup + chips fidelity (U10/U11)', () => {
  afterEach(() => {
    cleanup();
  });

  it('parses icon-from-lookup fields including lookupEntries and booleans', () => {
    const fields = parseDesignerGridRichCellFields({
      valueField: 'person_type_code',
      lookupSource: 'person-types',
      showTooltip: true,
      fallbackIcon: 'CircleHelp',
      lookupEntries: [
        {
          value: '100.2.1',
          label: 'Individual',
          uiHtml: '<i data-lucide="User"></i>',
        },
      ],
    });

    expect(fields).toMatchObject({
      valueField: 'person_type_code',
      lookupSource: 'person-types',
      showTooltip: true,
      fallbackIcon: 'CircleHelp',
    });
    expect(fields?.lookupEntries).toEqual([
      {
        value: '100.2.1',
        label: 'Individual',
        uiHtml: '<i data-lucide="User"></i>',
      },
    ]);
  });

  it('parses chips display options with fixed-two-tone as the legacy default', () => {
    const fields = parseDesignerGridRichCellFields({
      valuesField: 'roles',
      colorMode: 'hash-palette',
      truncateLabelChars: 3,
      showTooltipOnTruncate: true,
      overlapMode: true,
    });
    expect(fields).toMatchObject({
      valuesField: 'roles',
      colorMode: 'hash-palette',
      truncateLabelChars: 3,
      showTooltipOnTruncate: true,
      overlapMode: true,
    });
    expect(defaultRichCellFieldsForKind('chips').colorMode).toBe('fixed-two-tone');
  });

  it('round-trips icon-from-lookup + hash-palette chips through column JSON', () => {
    const serialized = serializeDesignerDataGridColumns([
      USERS_PERSON_TYPE_ICON_COLUMN_PRESET,
      USERS_ROLES_CHIPS_COLUMN_PRESET,
    ]);
    const parsed = parseDesignerDataGridColumns(serialized);
    expect(parsed[0]?.cellKind).toBe('icon-from-lookup');
    expect(parsed[0]?.cellFields?.valueField).toBe('person_type_code');
    expect(parsed[1]?.cellKind).toBe('chips');
    expect(parsed[1]?.cellFields?.colorMode).toBe('hash-palette');
    expect(parsed[1]?.cellFields?.truncateLabelChars).toBe(3);
    expect(parsed[1]?.cellFields?.overlapMode).toBe(true);
  });

  it('resolves icon-from-lookup from embedded catalog then store then row enrichment', () => {
    const fields = {
      valueField: 'person_type_code',
      lookupSource: 'person-types',
      showTooltip: true,
      lookupEntries: [
        { value: '100.2.1', label: 'Individual', uiHtml: '<i data-lucide="User"></i>' },
      ],
      htmlField: 'person_type_uiHtml',
      labelField: 'person_type_label',
    };

    expect(resolveDesignerGridIconFromLookup(
      { person_type_code: '100.2.1' },
      fields,
      'person_type_code',
    )).toEqual({
      value: '100.2.1',
      label: 'Individual',
      uiHtml: '<i data-lucide="User"></i>',
    });

    expect(resolveDesignerGridIconFromLookup(
      { person_type_code: '100.2.2' },
      { ...fields, lookupEntries: undefined },
      'person_type_code',
      {
        lovCache: {
          'person-types': [
            { value: '100.2.2', label: 'Company', uiHtml: '<i data-lucide="Building2"></i>' },
          ],
        },
      },
    )).toEqual({
      value: '100.2.2',
      label: 'Company',
      uiHtml: '<i data-lucide="Building2"></i>',
    });

    expect(resolveDesignerGridIconFromLookup(
      {
        person_type_code: '100.2.1',
        person_type_uiHtml: '<i data-lucide="User"></i>',
        person_type_label: 'Individual',
      },
      { ...fields, lookupEntries: undefined },
      'person_type_code',
    )).toEqual({
      value: '100.2.1',
      label: 'Individual',
      uiHtml: '<i data-lucide="User"></i>',
    });
  });

  it('keeps fixed-two-tone chip colors identical to pre-Phase-27 behavior', () => {
    expect(resolveDesignerGridChipClass('ADMIN', undefined)).toBe('bg-indigo-100 text-indigo-700');
    expect(resolveDesignerGridChipClass('ADMIN', 'fixed-two-tone')).toBe('bg-indigo-100 text-indigo-700');
    expect(resolveDesignerGridChipClass('DEVELOPER', 'fixed-two-tone')).toBe('bg-slate-100 text-slate-600');
    expect(resolveDesignerGridChipClass('CUSTOM', 'fixed-two-tone')).toBe('bg-slate-100 text-slate-600');
  });

  it('hash-palette chips match Users getHashChipClass + truncate', () => {
    expect(resolveDesignerGridChipClass('ADMIN', 'hash-palette')).toBe(getHashChipClass('ADMIN'));
    expect(resolveDesignerGridChipClass('DEVELOPER', 'hash-palette')).toBe(getHashChipClass('DEVELOPER'));
    expect(resolveDesignerGridChipClass('CUSTOM', 'hash-palette')).toBe(getHashChipClass('CUSTOM'));
    expect(resolveDesignerGridChipClass('OTHER', 'hash-palette')).toBe(getHashChipClass('OTHER'));
    expect(resolveDesignerGridChipClass('CUSTOM', 'hash-palette'))
      .not.toBe(resolveDesignerGridChipClass('OTHER', 'hash-palette'));
    expect(resolveDesignerGridChipLabel('ADMIN', 3)).toBe('ADM');
    expect(resolveDesignerGridChipLabel('DEVELOPER', 3)).toBe('DEV');
    expect(resolveDesignerGridChipLabel('OK', 3)).toBe('OK');
  });

  it('renders icon-from-lookup with tooltip title from catalog', () => {
    const { container } = render(
      <DesignerGridRichCell
        row={{ person_type_code: '100.2.1' }}
        column={{
          key: 'person_type_code',
          label: '',
          cellKind: 'icon-from-lookup',
          cellFields: {
            valueField: 'person_type_code',
            showTooltip: true,
            lookupEntries: [
              { value: '100.2.1', label: 'Individual', uiHtml: '<i data-lucide="User"></i>' },
            ],
          },
        }}
        mode="runtime"
        canInvokeCellClick={false}
        onCellClick={() => undefined}
      />,
    );

    const tip = container.querySelector('[title="Individual"]');
    expect(tip).toBeTruthy();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders hash-palette chips truncated with tooltip and overlap classes', () => {
    const { container } = render(
      <DesignerGridRichCell
        row={{ roles: ['ADMIN', 'CUSTOMROLE'] }}
        column={{
          key: 'roles',
          label: 'Roles',
          cellKind: 'chips',
          cellFields: {
            valuesField: 'roles',
            colorMode: 'hash-palette',
            truncateLabelChars: 3,
            showTooltipOnTruncate: true,
            overlapMode: true,
          },
        }}
        mode="runtime"
        canInvokeCellClick={false}
        onCellClick={() => undefined}
      />,
    );

    const root = within(container);
    expect(root.getByLabelText('ADMIN')).toHaveTextContent('ADM');
    expect(root.getByLabelText('CUSTOMROLE')).toHaveTextContent('CUS');
    expect(container.querySelector('[title="CUSTOMROLE"]')).toBeTruthy();
    expect(container.querySelector('.-ms-2')).toBeTruthy();
    expect(root.getByLabelText('ADMIN').className).toContain(getHashChipClass('ADMIN'));
    expect(root.getByLabelText('CUSTOMROLE').className).toContain(getHashChipClass('CUSTOMROLE'));
  });

  it('renders fixed-two-tone chips without truncation (legacy look)', () => {
    const { container } = render(
      <DesignerGridRichCell
        row={{ roles: ['ADMIN', 'DEVELOPER'] }}
        column={{
          key: 'roles',
          label: 'Roles',
          cellKind: 'chips',
          cellFields: {
            valuesField: 'roles',
            colorMode: 'fixed-two-tone',
          },
        }}
        mode="runtime"
        canInvokeCellClick={false}
        onCellClick={() => undefined}
      />,
    );

    const root = within(container);
    expect(root.getByLabelText('ADMIN')).toHaveTextContent('ADMIN');
    expect(root.getByLabelText('DEVELOPER')).toHaveTextContent('DEVELOPER');
    expect(root.getByLabelText('ADMIN').className).toContain('bg-indigo-100');
    expect(root.getByLabelText('DEVELOPER').className).toContain('bg-slate-100');
  });
});
