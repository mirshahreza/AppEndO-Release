/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CultureProvider } from '../../../../core/culture/CultureContext';
import { UserFilterToolbar } from '../UserFilterToolbar';

afterEach(() => {
  cleanup();
});

describe('UserFilterToolbar', () => {
  const roles = ['ADMIN', 'DEVELOPER', 'EDITOR', 'MANAGER', 'VIEWER', 'AUDITOR'];

  const renderToolbar = (
    roleFilters: Record<string, boolean>,
    onRoleFiltersChange = vi.fn(),
  ) => render(
    <CultureProvider cultureId="us">
      <UserFilterToolbar
        searchInput=""
        onSearchInputChange={vi.fn()}
        availableRoles={roles}
        roleFilters={roleFilters}
        roleMatchLogic="or"
        onRoleMatchLogicChange={vi.fn()}
        onRoleFiltersChange={onRoleFiltersChange}
        personTypeOptions={[]}
        personTypeCode=""
        onPersonTypeCodeChange={vi.fn()}
        onAddIndividualUser={vi.fn()}
        onAddCompanyUser={vi.fn()}
        onRefresh={vi.fn()}
        isRefreshing={false}
        filterButtonProps={{ active: false, conditionCount: 0, onClick: vi.fn() }}
      />
    </CultureProvider>,
  );

  const rolesTrigger = () => screen.getByLabelText('Roles');

  it('renders roles as one multi-select instead of a checkbox chip per role', () => {
    renderToolbar({});

    expect(rolesTrigger().textContent).toMatch(/All/);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    for (const role of roles) {
      expect(screen.queryByRole('checkbox', { name: role })).not.toBeInTheDocument();
    }
  });

  it('summarizes several selected roles on the closed trigger', () => {
    renderToolbar({
      ADMIN: true,
      DEVELOPER: true,
      EDITOR: true,
    });

    expect(rolesTrigger().textContent).toMatch(/3 selected|ADMIN/);
  });

  it('lists every role inside the dropdown without expanding the toolbar', async () => {
    const onRoleFiltersChange = vi.fn();
    const onRoleMatchLogicChange = vi.fn();
    render(
      <CultureProvider cultureId="us">
        <UserFilterToolbar
          searchInput=""
          onSearchInputChange={vi.fn()}
          availableRoles={roles}
          roleFilters={{}}
          roleMatchLogic="or"
          onRoleMatchLogicChange={onRoleMatchLogicChange}
          onRoleFiltersChange={onRoleFiltersChange}
          personTypeOptions={[]}
          personTypeCode=""
          onPersonTypeCodeChange={vi.fn()}
          onAddIndividualUser={vi.fn()}
          onAddCompanyUser={vi.fn()}
          onRefresh={vi.fn()}
          isRefreshing={false}
          filterButtonProps={{ active: false, conditionCount: 0, onClick: vi.fn() }}
        />
      </CultureProvider>,
    );

    expect(screen.queryByRole('group', { name: 'Role filter match logic' })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(rolesTrigger());
    });

    expect(await screen.findByRole('group', { name: 'Role filter match logic' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'AND' })).toBeInTheDocument();

    for (const role of roles) {
      expect(await screen.findByRole('option', { name: role })).toBeInTheDocument();
    }

    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: 'ADMIN' }));
    });

    expect(onRoleFiltersChange).toHaveBeenCalled();
    const next = onRoleFiltersChange.mock.calls.at(-1)?.[0] as Record<string, boolean>;
    expect(next.ADMIN).toBe(true);
    expect(next.DEVELOPER).toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'AND' }));
    });
    expect(onRoleMatchLogicChange).toHaveBeenCalledWith('and');
  });
});
