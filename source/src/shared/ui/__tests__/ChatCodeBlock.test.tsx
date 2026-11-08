/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ChatCodeBlock } from '../ChatCodeBlock';

describe('ChatCodeBlock', () => {
  afterEach(() => {
    cleanup();
  });

  it('collapses code longer than five lines', () => {
    const code = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'].join('\n');
    const { container } = render(<ChatCodeBlock code={code} language="plain" />);
    const pre = container.querySelector('pre');
    expect(pre).toHaveTextContent('one');
    expect(pre).toHaveTextContent('five');
    expect(pre).not.toHaveTextContent('six');
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more lines' }));
    expect(pre).toHaveTextContent('seven');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse code' }));
    expect(pre).not.toHaveTextContent('seven');
  });

  it('renders only changed lines for a full handler dump', () => {
    const before = [
      'async function handler(): Promise<void> {',
      '  edgeRes.status(400).json({ error: "Missing key" });',
      '}',
      '(async () => { await handler(); })();',
    ].join('\n');
    const after = [
      'async function handler(): Promise<void> {',
      '  edgeRes.json({ ok: true });',
      '}',
      '(async () => { await handler(); })();',
    ].join('\n');
    render(<ChatCodeBlock code={after} language="typescript" diffAgainst={before} />);
    expect(screen.getByText('Diff')).toBeInTheDocument();
    expect(screen.getByText(/edgeRes\.json\(\{ ok: true \}\)/)).toBeInTheDocument();
    expect(screen.queryByText('async function handler(): Promise<void> {')).not.toBeInTheDocument();
  });

  it('shows no remaining changes when the dump matches the editor', () => {
    const source = [
      'async function handler(): Promise<void> {',
      '  edgeRes.json({ ok: true });',
      '}',
      '(async () => { await handler(); })();',
    ].join('\n');
    render(<ChatCodeBlock code={source} language="typescript" diffAgainst={source} />);
    expect(screen.getByText('No remaining changes')).toBeInTheDocument();
  });
});
