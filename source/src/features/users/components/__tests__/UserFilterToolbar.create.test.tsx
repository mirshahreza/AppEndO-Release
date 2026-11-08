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

describe('UserFilterToolbar create control', () => {
  it('uses a plus dropdown for individual and company create', async () => {
    const onAddIndividualUser = vi.fn();
    const onAddCompanyUser = vi.fn();

    render(
      <CultureProvider cultureId="us">
        <UserFilterToolbar
          searchInput=""
          onSearchInputChange={vi.fn()}
          availableRoles={[]}
          roleFilters={{}}
          roleMatchLogic="or"
          onRoleMatchLogicChange={vi.fn()}
          onRoleFiltersChange={vi.fn()}
          personTypeOptions={[]}
          personTypeCode=""
          onPersonTypeCodeChange={vi.fn()}
          onAddIndividualUser={onAddIndividualUser}
          onAddCompanyUser={onAddCompanyUser}
          onRefresh={vi.fn()}
          isRefreshing={false}
          filterButtonProps={{ active: false, conditionCount: 0, onClick: vi.fn() }}
        />
      </CultureProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Add Company' }));
    });

    expect(onAddCompanyUser).toHaveBeenCalledTimes(1);
    expect(onAddIndividualUser).not.toHaveBeenCalled();
  });
});
