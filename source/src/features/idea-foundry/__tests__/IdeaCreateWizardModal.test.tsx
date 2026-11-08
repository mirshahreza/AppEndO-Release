// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../../shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/ui')>();
  return {
    ...actual,
    DesignerMarkdownEditorField: ({
      value,
      onChange,
      placeholder,
      ariaLabel,
    }: {
      value?: string;
      onChange?: (next: string) => void;
      placeholder?: string;
      ariaLabel?: string;
    }) => (
      <textarea
        aria-label={ariaLabel ?? 'Idea description'}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
      />
    ),
    NavigationIconPickerDialog: ({
      open,
      onSelect,
    }: {
      open: boolean;
      onSelect: (icon: string) => void;
    }) => (
      open ? (
        <button type="button" onClick={() => onSelect('lucide:Sparkles')}>
          Pick Sparkles
        </button>
      ) : null
    ),
  };
});

import { IdeaCreateWizardModal } from '../components/IdeaCreateWizardModal';

const CMS_HOME = {
  packageId: 'cms',
  displayName: 'CMS',
  icon: 'Newspaper',
  sections: [
    { key: 'whole-package', title: 'Whole package' },
    { key: 'cms-contents-list', title: 'Contents' },
  ],
};

const ACTOR = {
  userId: 7,
  displayName: 'Ada Admin',
  username: 'ada',
  avatarUrl: null as string | null,
};

const MODELS = [
  { id: 'model-1', name: 'Workshop model', isDefault: true },
  { id: 'model-2', name: 'Backup model' },
];

const renderWizard = (
  props: Partial<React.ComponentProps<typeof IdeaCreateWizardModal>> = {},
) => render(
  <IdeaCreateWizardModal
    open
    isSaving={false}
    error={null}
    homes={[CMS_HOME]}
    actor={ACTOR}
    availableModels={MODELS}
    onClose={() => undefined}
    onCreate={() => undefined}
    {...props}
  />,
);

describe('IdeaCreateWizardModal', () => {
  afterEach(() => {
    cleanup();
  });

  const fillSpark = () => {
    fireEvent.change(screen.getByLabelText('Idea title'), { target: { value: 'Night-shift board' } });
    fireEvent.change(screen.getByLabelText('Idea description'), {
      target: { value: 'Clerks still reconcile pick lists by hand each night.' },
    });
  };

  const goToTeam = async () => {
    fillSpark();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('radio', { name: /New package/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Choose idea icon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick Sparkles' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(await screen.findByLabelText('Front office'), {
      target: { value: 'Guest scans a barcode on the shop floor and pays.' },
    });
    fireEvent.change(screen.getByLabelText('Back office'), {
      target: { value: 'Clerk confirms the pick and clears a short-pick exception.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Importance')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Ada Admin')).toBeTruthy();
  };

  it('registers an idea after spark, domain, surfaces, weight, and team', async () => {
    const onCreate = vi.fn();
    renderWizard({ onCreate });

    await goToTeam();
    expect(screen.getByText('Workshop model')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove Workshop model' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Register idea' }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        title: 'Night-shift board',
        description: 'Clerks still reconcile pick lists by hand each night.',
        icon: 'lucide:Sparkles',
        importance: 'medium',
        scale: 'small',
        maturity: 'defining',
        targetKind: 'new-package',
        packageId: null,
        packageTitle: null,
        sectionKey: null,
        sectionTitle: null,
        frontOffice: 'Guest scans a barcode on the shop floor and pays.',
        backOffice: 'Clerk confirms the pick and clears a short-pick exception.',
        note: null,
        decisionMaker: ACTOR,
        collaborators: [],
        models: [MODELS[0]],
      });
    });
  });

  it('stays on the spark step when title is empty', async () => {
    const onCreate = vi.fn();
    renderWizard({ onCreate });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText('Idea title')).toBeTruthy();
    expect(screen.queryByText('Title is required.')).toBeNull();
    expect(screen.queryByText('Description is required.')).toBeNull();
    await waitFor(() => {
      expect(screen.queryByRole('radio', { name: /Existing package/i })).toBeNull();
    });
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('lets Next leave the domain step without choosing an icon', async () => {
    const onCreate = vi.fn();
    renderWizard({ onCreate });
    fillSpark();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('radio', { name: /New package/i })).toBeTruthy();
    expect(screen.getByText(/lucide:Lightbulb \(default\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByLabelText('Front office')).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('registers a new package with the Lightbulb default when no icon is chosen', async () => {
    const onCreate = vi.fn();
    renderWizard({ onCreate });
    fillSpark();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('radio', { name: /New package/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(await screen.findByLabelText('Front office'), {
      target: { value: 'Guest scans a barcode on the shop floor and pays.' },
    });
    fireEvent.change(screen.getByLabelText('Back office'), {
      target: { value: 'Clerk confirms the pick and clears a short-pick exception.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Ada Admin')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Register idea' }));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
        icon: 'lucide:Lightbulb',
        targetKind: 'new-package',
      }));
    });
  });

  it('lets the operator choose an existing package even when the catalog is still empty', async () => {
    const onCreate = vi.fn();
    renderWizard({ onCreate, homes: [] });
    fillSpark();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const existing = await screen.findByRole('radio', { name: /Existing package/i });
    expect((existing as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('Package')).toBeTruthy();
    fireEvent.click(existing);
    expect(screen.getByText('Existing Packages')).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('stays on the domain step when an existing package is not chosen', async () => {
    const onCreate = vi.fn();
    renderWizard({ onCreate });
    fillSpark();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Existing package/i }));
    expect(screen.getByText('Existing Packages')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'CMS' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Existing Packages')).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText('Ada Admin')).toBeNull();
    });
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('continues after the operator picks one existing package', async () => {
    const onCreate = vi.fn();
    renderWizard({ onCreate });
    fillSpark();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Existing package/i }));
    fireEvent.click(screen.getByRole('radio', { name: 'CMS' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByLabelText('Front office')).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('stays on the team step until a model is chosen', async () => {
    const onCreate = vi.fn();
    renderWizard({ onCreate, availableModels: [] });
    await goToTeam();
    fireEvent.click(screen.getByRole('button', { name: 'Register idea' }));
    expect(await screen.findByText('Choose at least one model.')).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('keeps the default model and lets extra models be removed', async () => {
    renderWizard();
    await goToTeam();
    fireEvent.click(screen.getByRole('button', { name: 'Add model' }));
    fireEvent.click(await screen.findByRole('button', { name: /Backup model/i }));
    fireEvent.click(screen.getByRole('button', { name: /Add \(1\)/i }));
    expect(screen.getByText('Backup model')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Backup model' }));
    expect(screen.queryByText('Backup model')).toBeNull();
    expect(screen.getByText('Workshop model')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove Workshop model' })).toBeNull();
  });

  it('lets a supporting model become the lead', async () => {
    const onCreate = vi.fn();
    renderWizard({ onCreate });
    await goToTeam();
    expect(screen.getByText('Lead model')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add model' }));
    fireEvent.click(await screen.findByRole('button', { name: /Backup model/i }));
    fireEvent.click(screen.getByRole('button', { name: /Add \(1\)/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Make Backup model the lead model' }));
    expect(screen.getByRole('button', { name: 'Make Workshop model the lead model' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove Backup model' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Register idea' }));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
        models: [MODELS[1], MODELS[0]],
      }));
    });
  });

  it('hydrates the wizard from the current idea and keeps the existing decision maker and stage', async () => {
    const onCreate = vi.fn();
    const owner = {
      userId: 99,
      displayName: 'Bea Builder',
      username: 'bea',
      avatarUrl: null as string | null,
    };
    const idea = {
      id: 'idea-9',
      title: 'Night-shift board',
      description: 'Clerks still reconcile pick lists by hand each night.',
      icon: 'lucide:Sparkles',
      importance: 'high' as const,
      scale: 'large' as const,
      maturity: 'cooking-idea' as const,
      targetKind: 'new-package' as const,
      packageId: null,
      packageTitle: null,
      sectionKey: null,
      sectionTitle: null,
      frontOffice: 'Guest scans a barcode on the shop floor and pays.',
      backOffice: 'Clerk confirms the pick and clears a short-pick exception.',
      note: null,
      decisionMaker: owner,
      collaborators: [ACTOR],
      models: MODELS,
      createdAt: '2026-08-01T00:00:00.000Z',
      createdBy: 99,
      createdByUsername: 'bea',
      updatedAt: '2026-08-28T00:00:00.000Z',
      updatedBy: 99,
      updatedByUsername: 'bea',
    };

    renderWizard({ mode: 'reconfigure', initialIdea: idea, onCreate });

    await waitFor(() => {
      expect((screen.getByLabelText('Idea title') as HTMLInputElement).value).toBe('Night-shift board');
    });
    fireEvent.change(screen.getByLabelText('Idea title'), { target: { value: 'Night-shift dispatch' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('radio', { name: /New package/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByLabelText('Front office')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Importance')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Bea Builder')).toBeTruthy();
    expect(screen.queryByText('Ada Admin')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reconfigure idea' }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        title: 'Night-shift dispatch',
        description: 'Clerks still reconcile pick lists by hand each night.',
        icon: 'lucide:Sparkles',
        importance: 'high',
        scale: 'large',
        maturity: 'cooking-idea',
        targetKind: 'new-package',
        packageId: null,
        packageTitle: null,
        sectionKey: null,
        sectionTitle: null,
        frontOffice: 'Guest scans a barcode on the shop floor and pays.',
        backOffice: 'Clerk confirms the pick and clears a short-pick exception.',
        note: null,
        decisionMaker: owner,
        collaborators: [ACTOR],
        models: MODELS,
      });
    });
  });
});
