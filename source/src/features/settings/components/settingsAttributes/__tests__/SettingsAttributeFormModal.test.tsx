// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CultureProvider } from '../../../../../core/culture/CultureContext';
import { EMPTY_SETTINGS_ATTRIBUTE_FORM } from '../constants';
import { SettingsAttributeFormModal } from '../SettingsAttributeFormModal';

vi.mock('../../../../../shared/api/queries/base-info', () => ({
  useBaseInfoChildrenQuery: () => ({ data: [], isLoading: false }),
  fetchBaseInfoChildren: vi.fn(async () => []),
  fetchBaseInfoAncestorPath: vi.fn(async () => []),
  formatBaseInfoTreeLabel: (row: { id: string; label?: string }) => `${row.id} — ${row.label ?? row.id}`,
}));

const renderModal = (scope: 'USER' | 'ROLE') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CultureProvider cultureId="us" translationBundleSource="embedded">
        <SettingsAttributeFormModal
          open
          title={`Create ${scope === 'USER' ? 'User' : 'Role'} Attribute`}
          submitLabel="Create"
          form={{ ...EMPTY_SETTINGS_ATTRIBUTE_FORM }}
          onFormChange={() => undefined}
          formError={null}
          isSaving={false}
          scope={scope}
          onClose={() => undefined}
          onSubmit={() => undefined}
        />
      </CultureProvider>
    </QueryClientProvider>,
  );
};

describe('SettingsAttributeFormModal create', () => {
  afterEach(() => {
    cleanup();
  });

  it('opens the create user attribute dialog without throwing', () => {
    expect(() => renderModal('USER')).not.toThrow();
    expect(screen.getByRole('dialog', { name: /Create User Attribute/i })).toBeTruthy();
  });

  it('opens the create role attribute dialog without throwing', () => {
    expect(() => renderModal('ROLE')).not.toThrow();
    expect(screen.getByRole('dialog', { name: /Create Role Attribute/i })).toBeTruthy();
  });
});
