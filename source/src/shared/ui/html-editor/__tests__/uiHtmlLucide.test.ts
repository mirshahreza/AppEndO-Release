import { describe, expect, it } from 'vitest';
import { isLucideOnlyUiHtml } from '../uiHtmlLucide';

describe('isLucideOnlyUiHtml', () => {
  it('matches lucide icon snippets', () => {
    expect(isLucideOnlyUiHtml('<i data-lucide="User"></i>')).toBe(true);
    expect(isLucideOnlyUiHtml('<i data-lucide="User" />')).toBe(true);
  });

  it('rejects rich html', () => {
    expect(isLucideOnlyUiHtml('<p>Hello</p>')).toBe(false);
    expect(isLucideOnlyUiHtml('<i data-lucide="User"></i><span>x</span>')).toBe(false);
  });
});
