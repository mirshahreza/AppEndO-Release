import { describe, expect, it } from 'vitest';
import { formatHtmlSource } from '../formatHtmlSource';

describe('formatHtmlSource', () => {
  it('returns empty input unchanged', async () => {
    await expect(formatHtmlSource('')).resolves.toBe('');
    await expect(formatHtmlSource('   ')).resolves.toBe('   ');
  });

  it('pretty-prints compact HTML', async () => {
    const formatted = await formatHtmlSource('<div><p>Hello</p><ul><li>One</li><li>Two</li></ul></div>');
    expect(formatted).toContain('<div>');
    expect(formatted).toContain('<p>Hello</p>');
    expect(formatted.split('\n').length).toBeGreaterThan(1);
  });
});
