/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { DataSourceType, type DataSourceRecord } from '../../../shared/api/contracts/data-sources/types';
import { SqlConsoleNewTabMenu } from '../SqlConsoleNewTabMenu';

afterEach(cleanup);

const sources: DataSourceRecord[] = [
  {
    id: 'ds_a',
    name: 'Reporting',
    type: DataSourceType.POSTGRES,
    host: 'localhost',
    port: 5432,
    status: 'connected',
    isDefault: true,
  },
  {
    id: 'ds_b',
    name: 'Warehouse',
    type: DataSourceType.SQL_SERVER,
    host: 'localhost',
    port: 1433,
    status: 'connected',
  },
];

describe('SqlConsoleNewTabMenu', () => {
  it('opens a connection menu and creates a tab only after a pick', () => {
    const onPick = vi.fn();
    render(<SqlConsoleNewTabMenu dataSources={sources} onPick={onPick} />);

    fireEvent.click(screen.getByRole('button', { name: 'New query' }));
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole('menu', { name: 'Choose connection' })).toBeTruthy();

    fireEvent.click(screen.getByRole('menuitem', { name: /Warehouse/ }));
    expect(onPick).toHaveBeenCalledExactlyOnceWith('ds_b');
  });
});
