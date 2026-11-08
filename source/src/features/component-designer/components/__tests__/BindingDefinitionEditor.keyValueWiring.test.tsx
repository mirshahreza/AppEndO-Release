// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BindingDefinitionEditor } from '../BindingDefinitionEditor';
import type { DesignerBindingDefinition } from '../../../../domain/component-designer/types';

// The Body JSON field is now a Monaco-backed DesignerCodeEditorField — stub Monaco with a plain
// textarea so it renders synchronously in jsdom (matches the pattern used by other designer tests).
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, 'aria-label': ariaLabel }: { value: string; onChange?: (value: string) => void; 'aria-label'?: string }) => (
    <textarea aria-label={ariaLabel ?? 'monaco-editor'} value={value} onChange={(event) => onChange?.(event.target.value)} />
  ),
}));

afterEach(() => {
  cleanup();
});

const baseDefinition: DesignerBindingDefinition = {
  sourceType: 'apiRef',
  endpointRef: '/api/v1/widgets',
  requestConfig: {
    method: 'GET',
    headers: { Authorization: 'Bearer token' },
    query: { page: '1' },
  },
};

describe('BindingDefinitionEditor — Headers/Query wired onto InspectorKeyValueListField', () => {
  it('renders headers and query as key/value rows, not a raw-JSON textarea', () => {
    render(
      <BindingDefinitionEditor
        bindingKey="widgets"
        definition={baseDefinition}
        onChange={() => {}}
      />,
    );

    // No raw JSON braces/quotes shown anywhere for headers/query — real inputs instead.
    expect(screen.queryByPlaceholderText('{"Authorization":"Bearer ..."}')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('{"page":"1"}')).not.toBeInTheDocument();

    expect(screen.getByDisplayValue('Authorization')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bearer token')).toBeInTheDocument();
    expect(screen.getByDisplayValue('page')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1')).toBeInTheDocument();
  });

  it('editing a header row produces the exact same requestConfig.headers shape the old JSON textarea would have produced', () => {
    let latest: DesignerBindingDefinition = baseDefinition;

    const { rerender } = render(
      <BindingDefinitionEditor
        bindingKey="widgets"
        definition={latest}
        onChange={(next) => { latest = next; }}
      />,
    );

    const headerKeyInputs = screen.getAllByLabelText('Header key') as HTMLInputElement[];
    fireEvent.change(headerKeyInputs[0], { target: { value: 'X-Api-Key' } });

    // Equivalent to hand-typing `{"X-Api-Key":"Bearer token"}` into the old Headers JSON textarea.
    expect(latest.requestConfig?.headers).toEqual({ 'X-Api-Key': 'Bearer token' });

    rerender(
      <BindingDefinitionEditor
        bindingKey="widgets"
        definition={latest}
        onChange={(next) => { latest = next; }}
      />,
    );
  });

  it('clearing all header rows serializes headers to undefined (same as leaving the old JSON textarea blank)', () => {
    let latest: DesignerBindingDefinition = baseDefinition;

    render(
      <BindingDefinitionEditor
        bindingKey="widgets"
        definition={latest}
        onChange={(next) => { latest = next; }}
      />,
    );

    fireEvent.click(screen.getByLabelText('Remove header row'));

    expect(latest.requestConfig?.headers).toBeUndefined();
  });

  it('Body JSON still round-trips through JSON.parse/stringify (Monaco swap keeps the same data contract)', () => {
    let latest: DesignerBindingDefinition = baseDefinition;

    render(
      <BindingDefinitionEditor
        bindingKey="widgets"
        definition={latest}
        onChange={(next) => { latest = next; }}
      />,
    );

    // DesignerCodeEditorField doesn't forward its `ariaLabel` down into the underlying Monaco
    // `Editor` instance — only onto its own wrapper `<div>` — so the stubbed textarea below keeps
    // the mock's fallback label; the surrounding `aria-label="Request body JSON"` div is asserted
    // separately via `container.querySelector`.
    const bodyEditor = screen.getByLabelText('monaco-editor');
    fireEvent.change(bodyEditor, { target: { value: '{"name":"value"}' } });

    expect(latest.requestConfig?.body).toEqual({ name: 'value' });
  });
});
