// @vitest-environment jsdom

/**
 * Phase 15 — primary action intent + multi-step indicator alignment (catalog dialogs that remain).
 */

import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@heroui/react', async () => {
  const { componentDesignerHeroUiMock } = await import('../../../../test-support/componentDesignerHeroUiMock');
  return componentDesignerHeroUiMock;
});

vi.mock('../../../../shared/api/queries/my-apis', () => ({
  useAccessibleApiRoutesQuery: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../../../shared/api/queries/api-endpoint-schema', () => ({
  useApiEndpointSchemaQuery: () => ({
    data: null,
    isLoading: false,
    isError: false,
  }),
  resolveEndpointFormFieldsFromOpenApi: vi.fn(() => []),
  resolveEndpointResponseFormFieldsFromOpenApi: vi.fn(() => []),
}));

import { CreateComponentWizardDialog } from '../create-wizard/CreateComponentWizardDialog';
import { StepWizardShell } from '../../../../shared/ui/StepWizardShell';
import { getButtonIntentClassName } from '../../../../shared/ui/buttonSemantics';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = HTMLDialogElement.prototype.showModal
    ?? function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  HTMLDialogElement.prototype.close = HTMLDialogElement.prototype.close
    ?? function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
});

afterEach(() => {
  cleanup();
  document.body.querySelectorAll('[data-designer-dialog-backdrop]').forEach((node) => node.remove());
  document.body.querySelectorAll('[data-step-wizard-backdrop]').forEach((node) => node.remove());
});

const PRIMARY_CLASS = getButtonIntentClassName('primary', undefined, 'sm');
const SECONDARY_CLASS = getButtonIntentClassName('secondary', undefined, 'sm');

describe('Phase 15 — primary action intent alignment', () => {
  it('StepWizardShell Next uses primary intent on intermediate steps (not secondary)', () => {
    render(
      <StepWizardShell
        title="Demo wizard"
        steps={['One', 'Two', 'Three']}
        step={0}
        onStepChange={vi.fn()}
        onClose={vi.fn()}
      >
        <div>body</div>
      </StepWizardShell>,
    );

    const next = screen.getByRole('button', { name: /Next/i });
    expect(PRIMARY_CLASS.split(/\s+/).every((token) => next.className.includes(token))).toBe(true);
    expect(SECONDARY_CLASS.split(/\s+/).every((token) => next.className.includes(token))).toBe(false);
  });
});

describe('Phase 15 — create wizard catalog kinds', () => {
  it('CreateComponentWizardDialog has no Start kind cards', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <CreateComponentWizardDialog open initialKind="empty" onClose={vi.fn()} onComplete={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.queryByRole('radio', { name: /API Connected Form/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /CRUD Set/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /^Templates/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /^Empty/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Component name/i)).toBeInTheDocument();

    const descriptionBand = document.body.querySelector('[data-step-wizard-description]');
    expect(descriptionBand?.className).toContain('bg-slate-200/50');
    expect(descriptionBand?.className).not.toContain('step-wizard-description-band');

    expect(document.body.querySelector('[data-step-tab-color]')?.getAttribute('data-step-tab-color')).toBe('theme');

    const backdrop = document.body.querySelector('[data-step-wizard-backdrop]');
    const shell = backdrop?.firstElementChild as HTMLElement | null;
    expect(shell?.className).toContain('h-[calc(100vh-32px)]');
    expect(shell?.className).not.toContain('h-[85vh]');
  });

  it('Templates opens the layout gallery as the first wizard step', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <CreateComponentWizardDialog open initialKind="templates" onClose={vi.fn()} onComplete={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/You will name it next/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Create$/i })).toBeNull();
  });

  it('CRUD Set opens on the collection-mode question, not the name step', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <CreateComponentWizardDialog open initialKind="crud-set" onClose={vi.fn()} onComplete={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getAllByText(/Build with my suggestions now/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Go to step 1: Collection/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Create$/i })).toBeNull();
    expect(screen.queryByLabelText(/Component name/i)).toBeNull();
    expect(screen.getByText(/Create CRUD Set/i)).toBeInTheDocument();
  });

  it('Empty opens on the name step', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <CreateComponentWizardDialog open initialKind="empty" onClose={vi.fn()} onComplete={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText(/Component name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Create$/i })).toBeInTheDocument();
  });
});
