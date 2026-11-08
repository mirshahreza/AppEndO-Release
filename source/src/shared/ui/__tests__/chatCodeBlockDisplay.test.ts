import { describe, expect, it } from 'vitest';
import { CHAT_CODE_BLOCK_COLLAPSE_AFTER_LINES, resolveChatCodeDisplay } from '../chatCodeBlockDisplay';

describe('resolveChatCodeDisplay', () => {
  it('keeps short snippets as code', () => {
    const display = resolveChatCodeDisplay('const x = 1;', { diffAgainst: 'const x = 1;\nconst y = 2;' });
    expect(display.mode).toBe('code');
    expect(display.lines).toEqual([{ kind: 'plain', text: 'const x = 1;' }]);
  });

  it('shows only changed lines for a full handler replacement', () => {
    const before = [
      'async function handler(): Promise<void> {',
      '  edgeRes.status(400).json({ error: "Missing key" });',
      '}',
      '(async () => { await handler(); })();',
    ].join('\n');
    const after = [
      'async function handler(): Promise<void> {',
      '  edgeRes.json({ ok: true, warning: "Missing key" });',
      '}',
      '(async () => { await handler(); })();',
    ].join('\n');

    const display = resolveChatCodeDisplay(after, { diffAgainst: before });
    expect(display.mode).toBe('diff');
    expect(display.lines).toEqual([
      { kind: 'remove', text: '  edgeRes.status(400).json({ error: "Missing key" });' },
      { kind: 'add', text: '  edgeRes.json({ ok: true, warning: "Missing key" });' },
    ]);
  });

  it('always diffs command-card replacements', () => {
    const display = resolveChatCodeDisplay('b', { diffAgainst: 'a', diffMode: 'always' });
    expect(display.mode).toBe('diff');
    expect(display.lines).toEqual([
      { kind: 'remove', text: 'a' },
      { kind: 'add', text: 'b' },
    ]);
  });

  it('collapses after five lines', () => {
    expect(CHAT_CODE_BLOCK_COLLAPSE_AFTER_LINES).toBe(5);
  });

  it('hides an identical full replacement as an empty diff', () => {
    const source = [
      'async function handler(): Promise<void> {',
      '  edgeRes.json({ ok: true });',
      '}',
      '(async () => { await handler(); })();',
    ].join('\n');
    const display = resolveChatCodeDisplay(source, { diffAgainst: source });
    expect(display).toEqual({ mode: 'diff', lines: [] });
  });
});
