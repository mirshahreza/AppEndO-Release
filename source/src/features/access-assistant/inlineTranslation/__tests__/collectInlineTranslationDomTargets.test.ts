/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { collectInlineTranslationDomTargets } from '../collectInlineTranslationDomTargets';

describe('collectInlineTranslationDomTargets', () => {
  it('maps resolved keys to visible text nodes', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Users</p><span>Other</span>';
    document.body.appendChild(root);
    const paragraph = root.querySelector('p');
    if (paragraph instanceof HTMLElement) {
      paragraph.getBoundingClientRect = () => ({
        width: 48,
        height: 16,
        top: 0,
        left: 0,
        right: 48,
        bottom: 16,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    }

    const keys = new Map<string, string>([
      ['nav.users', 'Users'],
      ['nav.roles', 'Roles'],
    ]);

    const targets = collectInlineTranslationDomTargets(root, keys);
    expect(targets).toHaveLength(1);
    expect(targets[0]?.key).toBe('nav.users');
    expect(targets[0]?.displayedText).toBe('Users');

    document.body.removeChild(root);
  });

  it('skips nodes inside the inline translation layer', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-inline-translation-layer><p>Users</p></div>';
    document.body.appendChild(root);

    const keys = new Map<string, string>([['nav.users', 'Users']]);
    const targets = collectInlineTranslationDomTargets(root, keys);
    expect(targets).toHaveLength(0);

    document.body.removeChild(root);
  });
});
