// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ProductIdeaRecord } from '../../../shared/api/contracts/idea-foundry/types';
import { IdeaFoundryView } from '../components/IdeaFoundryView';

vi.mock('../../../shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/ui')>();
  return {
    ...actual,
    MarkdownEditDialog: ({
      open,
      title,
      initialValue,
      onSave,
      onClose,
    }: {
      open: boolean;
      title: string;
      initialValue: string;
      onSave: (value: string) => void;
      onClose: () => void;
    }) => (open ? (
      <div role="dialog" aria-label={title}>
        <textarea aria-label={`${title} draft`} defaultValue={initialValue} />
        <button type="button" onClick={() => onSave(`${initialValue} updated`)}>Save</button>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    ) : null),
  };
});

const idea: ProductIdeaRecord = {
  id: 'idea-1',
  title: 'Night-shift board',
  description: 'Clerks still reconcile pick lists by hand each night.',
  icon: 'lucide:Moon',
  importance: 'medium',
  scale: 'small',
  maturity: 'defining',
  targetKind: 'new-package',
  packageId: null,
  packageTitle: null,
  sectionKey: null,
  sectionTitle: null,
  frontOffice: 'Guest scans a barcode.',
  backOffice: 'Clerk confirms the pick.',
  note: null,
  decisionMaker: {
    userId: 1,
    displayName: 'Ada Admin',
    username: 'ada',
    avatarUrl: null,
  },
  collaborators: [],
  models: [{ id: 'model-1', name: 'Workshop model' }],
  createdAt: '2026-08-01T00:00:00.000Z',
  createdBy: 1,
  createdByUsername: 'admin',
  updatedAt: '2026-08-28T00:00:00.000Z',
  updatedBy: 1,
  updatedByUsername: 'admin',
};

const renderView = (
  props: Partial<React.ComponentProps<typeof IdeaFoundryView>> = {},
) => render(
  <IdeaFoundryView
    idea={idea}
    onBack={() => undefined}
    onReconfigure={() => undefined}
    onSaveTitle={() => undefined}
    onSaveMarkdown={() => undefined}
    {...props}
  />,
);

describe('IdeaFoundryView', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('puts Reconfigure on the right of the content header', () => {
    const onReconfigure = vi.fn();
    renderView({ onReconfigure });

    const button = screen.getByRole('button', { name: 'Reconfigure' });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onReconfigure).toHaveBeenCalledTimes(1);
  });

  it('puts the title and unlabeled stage chip in the content header', () => {
    renderView();

    const view = screen.getByTestId('idea-foundry-view');
    const body = screen.getByTestId('idea-foundry-view-body');
    const title = screen.getByTestId('idea-foundry-view-title');
    const stage = screen.getByLabelText('Stage');
    expect(view).toContainElement(title);
    expect(body).not.toContainElement(title);
    expect(title.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(stage).toHaveTextContent('Defining');
    expect(screen.queryByText(/^Stage$/)).not.toBeInTheDocument();
  });

  it('does not open title edit on a single click', () => {
    const onSaveTitle = vi.fn();
    renderView({ onSaveTitle });

    fireEvent.click(screen.getByTestId('idea-foundry-view-title'));
    expect(screen.queryByLabelText('Idea title')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onSaveTitle).not.toHaveBeenCalled();
  });

  it('edits the header title as plain text on double-click without a markdown dialog', () => {
    const onSaveTitle = vi.fn();
    renderView({ onSaveTitle });

    fireEvent.doubleClick(screen.getByTestId('idea-foundry-view-title'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const input = screen.getByLabelText('Idea title');
    fireEvent.change(input, { target: { value: 'Night-shift dispatch' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSaveTitle).toHaveBeenCalledWith('Night-shift dispatch');
  });

  it('opens a markdown editor from spark and saves immediately', () => {
    const onSaveMarkdown = vi.fn();
    renderView({ onSaveMarkdown });

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit spark' })[0]);
    expect(screen.getByRole('dialog', { name: 'Edit spark' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSaveMarkdown).toHaveBeenCalledWith(
      'description',
      'Clerks still reconcile pick lists by hand each night. updated',
    );
  });

  it('groups the right rail into Metadata and Team cards', () => {
    renderView();

    const rail = screen.getByTestId('idea-foundry-view-rail');
    expect(rail.className).toContain('--app-inspector-rail-width');
    expect(rail.className).toContain('--app-inspector-rail-bg');
    expect(rail).toHaveClass('border-s');
    expect(rail).not.toHaveClass('w-80');
    expect(rail).not.toHaveTextContent('Identity');
    expect(rail).not.toHaveTextContent('Icon');
    expect(rail).toHaveTextContent('Metadata');
    expect(rail).toHaveTextContent('Team');
    expect(rail).not.toHaveTextContent('Audit trail');
    expect(rail).toHaveTextContent('Kind');
    expect(rail).toHaveTextContent('Importance');
    expect(rail).toHaveTextContent('Scale');
    expect(rail).not.toHaveTextContent('Domain');
    expect(rail).not.toHaveTextContent('Weight');
    expect(screen.getByTestId('idea-foundry-view-audit')).toHaveTextContent('Created');
    expect(screen.getByTestId('idea-foundry-view-audit')).toHaveTextContent('Edited');
    expect(screen.getByTestId('idea-foundry-view-audit')).toHaveTextContent('admin • Aug 1, 2026');
    expect(rail).toHaveTextContent('None selected');
    expect(rail).not.toHaveTextContent('lucide:');
  });

  it('exposes a ghost splitter between the body and the inspector', () => {
    renderView();

    const splitter = screen.getByRole('separator', { name: 'Drag to resize' });
    expect(splitter).toHaveAttribute('aria-orientation', 'vertical');
    expect(splitter.className).toContain('!bg-transparent');
    expect(splitter.querySelector('.rounded-full')).toBeNull();
    expect(screen.queryByRole('button', { name: /Collapse|Expand/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('idea-foundry-view-rail')).toHaveStyle({ width: '370px' });
  });

  it('opens a markdown editor from front office and saves immediately', () => {
    const onSaveMarkdown = vi.fn();
    renderView({ onSaveMarkdown });

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit front office' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSaveMarkdown).toHaveBeenCalledWith('frontOffice', 'Guest scans a barcode. updated');
  });
});
