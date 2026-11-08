/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { PlatformMountProvider } from '../../../app/platform/PlatformMountContext';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import { CultureProvider } from '../../../core/culture/CultureContext';
import type { PlatformMount } from '../../../shared/api/contracts/platform/types';
import { AppTableGrid } from '../../../shared/ui/AppTableGrid';
import { resolvePinnedColumnStyles } from '../../../shared/lib/appTableGridPinnedColumns';
import { buildAppTableGridColumns } from '../DesignerRuntimeAppTableGrid';

const hawietyIqMount: PlatformMount = {
  id: 'hawiety-iq',
  pathPrefix: '/iq/hawiety',
  name: 'Hawiety IQ',
  enabled: true,
  defaultRoute: '/iq/hawiety',
  designerRoutePropagation: 'manual',
  authProfile: {},
  cultureId: 'iq',
  experienceConfig: { locale: 'ar-IQ', calendar: 'gregorian', direction: 'rtl' },
};

const renderMemberGrid = (
  ui: React.ReactElement,
  options?: { cultureId?: 'ir' | 'iq' | 'us'; initialPath?: string },
) => {
  const cultureId = options?.cultureId ?? 'ir';
  const initialPath = options?.initialPath ?? (
    cultureId === 'ir' ? '/ir/hawiety/members' : '/iq/hawiety/members'
  );
  const mount = cultureId === 'ir'
    ? { ...hawietyIqMount, id: 'hawiety-ir', pathPrefix: '/ir/hawiety', cultureId: 'ir' as const }
    : hawietyIqMount;
  document.documentElement.setAttribute('dir', cultureId === 'us' ? 'ltr' : 'rtl');
  return render(
    <PlatformMountProvider mount={mount}>
      <CultureProvider cultureId={cultureId}>
        <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
      </CultureProvider>
    </PlatformMountProvider>,
  );
};

describe('HWY member grid column direction', () => {
  beforeEach(() => {
    bootstrapCultureRegistry(['us', 'ir', 'iq']);
  });

  afterEach(() => {
    document.documentElement.setAttribute('dir', 'ltr');
  });

  it('applies culture rtl on Member data cells while rich account content stays start-aligned', () => {
    const columns = buildAppTableGridColumns(
      [
        {
          key: 'displayFullName',
          label: 'Member',
          cellKind: 'account',
          cellFields: {
            primaryField: 'displayFullName',
            secondaryField: 'birthYear',
            accountLayout: 'stacked-text-lg',
          },
        },
      ],
      'server',
      {
        mode: 'runtime',
        detailFlowRef: { current: undefined },
        rowActionHandlerRef: { current: undefined },
        cellClickHandlerRef: { current: undefined },
        designerStoreRef: { current: undefined },
      },
    );

    renderMemberGrid(
      <AppTableGrid
        ariaLabel="Members"
        columns={columns}
        rows={[{ displayFullName: 'علي / شاكر', birthYear: '1955' }]}
        getRowKey={(row) => row.displayFullName}
      />,
      { cultureId: 'ir' },
    );

    const cell = screen.getByRole('cell', { name: /علي/ });
    expect(cell).toHaveAttribute('dir', 'rtl');
    expect(cell.querySelector('.text-left')).toBeNull();
    expect(cell.querySelector('.text-start')).not.toBeNull();
    expect(cell.querySelector('.items-start')).toBeNull();
  });

  it('rtl-aligns nakhebin voter and region rich cells with the shell', () => {
    const columns = buildAppTableGridColumns(
      [
        {
          key: 'firstName',
          label: 'Voter',
          cellKind: 'account',
          cellFields: {
            primaryField: 'voterNameLine1',
            secondaryField: 'voterNameLine2',
            accountLayout: 'stacked-text-lg',
          },
        },
        {
          key: 'electoralDivisionPath',
          label: 'Region',
          cellKind: 'account',
          cellFields: {
            primaryField: 'electoralDivisionLine1',
            secondaryField: 'electoralDivisionLine2',
            accountLayout: 'stacked-text',
          },
        },
      ],
      'server',
      {
        mode: 'runtime',
        detailFlowRef: { current: undefined },
        rowActionHandlerRef: { current: undefined },
        cellClickHandlerRef: { current: undefined },
        designerStoreRef: { current: undefined },
      },
    );

    renderMemberGrid(
      <AppTableGrid
        ariaLabel="Nakhebin"
        columns={columns}
        rows={[
          {
            voterNameLine1: 'سعاد خضير عباس | 1964',
            voterNameLine2: 'العزاوي',
            electoralDivisionPath: 'Iraq | Diyala | Khali | School',
          },
        ]}
        getRowKey={() => '1'}
      />,
      { cultureId: 'iq' },
    );

    const voterCell = screen.getByRole('cell', { name: /سعاد/ });
    expect(voterCell).toHaveAttribute('dir', 'rtl');
    expect(voterCell.querySelector('.items-start')).toBeNull();

    const regionCell = screen.getByRole('cell', { name: /Diyala/ });
    expect(regionCell).toHaveAttribute('dir', 'rtl');
    expect(regionCell.querySelector('.w-full.text-start')).not.toBeNull();
  });

  it('rtl-aligns institutes id column header with culture start edge', () => {
    const columns = buildAppTableGridColumns(
      [
        {
          key: 'id',
          label: 'Id',
          sort: true,
          width: '80px',
          textDirection: 'culture',
          headerClassName: 'text-start [&>div]:justify-start [&>div>span]:flex-none whitespace-nowrap',
          cellClassName: 'text-start tabular-nums font-semibold text-slate-700 whitespace-nowrap',
        },
      ],
      'server',
      {
        mode: 'runtime',
        detailFlowRef: { current: undefined },
        rowActionHandlerRef: { current: undefined },
        cellClickHandlerRef: { current: undefined },
        designerStoreRef: { current: undefined },
      },
    );

    renderMemberGrid(
      <AppTableGrid
        ariaLabel="Institutes"
        columns={columns}
        rows={[{ id: 1 }]}
        getRowKey={(row) => String(row.id)}
      />,
      { cultureId: 'iq' },
    );

    const header = screen.getByRole('columnheader', { name: 'Id' });
    expect(header).toHaveAttribute('dir', 'rtl');
    expect(header.className).toContain('text-start');
    expect(header.querySelector(':scope > div')?.className).toContain('justify-start');
  });

  it('applies explicit rtl on member-directory face and electoral columns for waited lists', () => {
    const runtimeOptions = {
      mode: 'runtime' as const,
      detailFlowRef: { current: undefined },
      rowActionHandlerRef: { current: undefined },
      cellClickHandlerRef: { current: undefined },
      designerStoreRef: { current: undefined },
    };
    const columns = buildAppTableGridColumns(
      [
        {
          key: 'displayFullName',
          label: 'Member',
          cellKind: 'hwy-member-face' as const,
          cellFields: {
            primaryField: 'displayFullName',
            secondaryField: 'birthYear',
            genderCodeField: 'genderCode',
            avatarSizePx: 43,
          },
          width: '243px',
        },
        {
          key: 'electoralDivisionPath',
          label: 'Region',
          cellKind: 'account' as const,
          cellFields: {
            primaryField: 'electoralDivisionLine1',
            secondaryField: 'electoralDivisionLine2',
            accountLayout: 'stacked-text' as const,
          },
        },
      ],
      'server',
      { ...runtimeOptions, shellIsRtl: true },
    );
    expect(columns.find((c) => c.id === 'displayFullName')?.textDirection).toBe('rtl');
    expect(columns.find((c) => c.id === 'electoralDivisionPath')?.textDirection).toBe('rtl');
  });

  it('pins call-center review column on inline-end for RTL member-directory waited grids', () => {
    const runtimeOptions = {
      mode: 'runtime' as const,
      detailFlowRef: { current: undefined },
      rowActionHandlerRef: { current: undefined },
      cellClickHandlerRef: { current: undefined },
      designerStoreRef: { current: undefined },
    };
    const memberListColumns = [
      {
        key: 'displayFullName',
        label: 'Member',
        cellKind: 'hwy-member-face' as const,
        cellFields: {
          primaryField: 'displayFullName',
          secondaryField: 'birthYear',
          genderCodeField: 'genderCode',
          avatarSizePx: 43,
        },
      },
      {
        key: 'nakhebinId',
        label: 'Family record',
        cellKind: 'account' as const,
        cellFields: {
          primaryField: 'nakhebinId',
          accountLayout: 'stacked-text-center' as const,
        },
      },
      {
        key: 'electoralDivisionPath',
        label: 'Electoral division',
        cellKind: 'account' as const,
        cellFields: {
          primaryField: 'electoralDivisionLine1',
          secondaryField: 'electoralDivisionLine2',
          electoralFallbackField: 'addrProvinceTitle',
          accountLayout: 'stacked-text' as const,
        },
      },
    ];
    const pathname = window.location.pathname;
    window.history.replaceState({}, '', '/iq/hawiety/members-waited-call-center');
    try {
      const columns = buildAppTableGridColumns(memberListColumns, 'server', runtimeOptions);
      const review = columns.find((column) => column.id === 'hwyMembershipQueueActions');
      expect(review).toBeTruthy();
      const pinStyles = resolvePinnedColumnStyles(columns);
      expect(pinStyles.get('hwyMembershipQueueActions')).toMatchObject({
        position: 'sticky',
        insetInlineEnd: 0,
      });
    } finally {
      window.history.replaceState({}, '', pathname);
    }
  });
});
