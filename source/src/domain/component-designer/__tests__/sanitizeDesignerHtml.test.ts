import { describe, expect, it } from 'vitest';
import { sanitizeDesignerHtml } from '../sanitizeDesignerHtml';

describe('sanitizeDesignerHtml (CD-J03 XSS)', () => {
  it('neutralizes script injection payloads', () => {
    const malicious = '<p>Hello</p><script>alert(1)</script>';
    const sanitized = sanitizeDesignerHtml(malicious);

    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('alert(1)');
    expect(sanitized).toContain('<p>Hello</p>');
  });

  it('strips inline event handlers', () => {
    const malicious = '<img src="x" onerror="alert(1)" />';
    const sanitized = sanitizeDesignerHtml(malicious);

    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain('alert(1)');
  });

  it('preserves safe rich text markup', () => {
    const safe = '<h2>Title</h2><p><strong>Bold</strong> and <em>italic</em></p>';
    expect(sanitizeDesignerHtml(safe)).toBe(safe);
  });

  it('preserves tables, images, and inline styles used by the editor', () => {
    const rich = '<p style="text-align: center"><span style="color: #4f46e5">Colored</span></p><img src="https://example.com/a.png" alt="A" /><table><tr><th>H</th><td>1</td></tr></table>';
    const sanitized = sanitizeDesignerHtml(rich);

    expect(sanitized).toContain('text-align: center');
    expect(sanitized).toContain('color: #4f46e5');
    expect(sanitized).toContain('<img');
    expect(sanitized).toContain('<table');
  });

  it('returns empty string for non-string input edge cases', () => {
    expect(sanitizeDesignerHtml('')).toBe('');
  });
});
