// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { InspectorPropDialogField } from '../InspectorPropDialogField';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (value: string) => void }) => (
    <textarea aria-label="monaco-editor" value={value} onChange={(event) => onChange?.(event.target.value)} />
  ),
}));

afterEach(() => {
  cleanup();
});

const jsonValidate = (draft: string): string | null => {
  const trimmed = draft.trim();
  if (trimmed.length === 0) return null;
  try {
    JSON.parse(trimmed);
    return null;
  } catch {
    return 'Invalid JSON — check for missing quotes, commas, or brackets.';
  }
};

describe('InspectorPropDialogField — Monaco upgrade for JSON-validating usages', () => {
  it('uses the Monaco-backed editor (not a plain textarea) when a `validate` prop is supplied', async () => {
    render(
      <InspectorPropDialogField
        label="Tree Data"
        value='[{"id":"1","label":"Node"}]'
        dialogTitle="Edit Tree Data"
        onChange={() => {}}
        validate={jsonValidate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit tree data' }));

    // The Monaco editor loads behind a lazy()/Suspense boundary — even mocked, module resolution
    // is async, so the "Loading editor…" fallback shows for a tick before it mounts.
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByLabelText('monaco-editor')).toBeInTheDocument();
  });

  it('still calls onChange with the raw text on Apply — same data contract as the old textarea', async () => {
    let latest = '';

    render(
      <InspectorPropDialogField
        label="Tree Data"
        value='[]'
        dialogTitle="Edit Tree Data"
        onChange={(next) => { latest = next; }}
        validate={jsonValidate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit tree data' }));
    const editor = await screen.findByLabelText('monaco-editor');
    fireEvent.change(editor, { target: { value: '[{"id":"2"}]' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(latest).toBe('[{"id":"2"}]');
  });

  it('keeps the plain textarea for non-JSON dialog usage (no `validate` prop, e.g. raw className editing)', () => {
    render(
      <InspectorPropDialogField
        label="className"
        value="flex gap-2"
        dialogTitle="Edit raw className"
        onChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit classname' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByLabelText('monaco-editor')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('textbox')).toBeInTheDocument();
  });
});
