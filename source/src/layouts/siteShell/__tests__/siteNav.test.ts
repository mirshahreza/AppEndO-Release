import { describe, expect, it } from 'vitest';
import { buildSiteHref, readSiteSlugFromPathname, siteNavLabel } from '../siteNav';

describe('siteNav', () => {
  it('builds public site hrefs on the culture home portal', () => {
    expect(buildSiteHref('us', { path: '' })).toBe('/us');
    expect(buildSiteHref('us', { path: 'about' })).toBe('/us/about');
    expect(buildSiteHref('us', { path: 'notes-from-the-north-quay' })).toBe('/us/notes-from-the-north-quay');
  });

  it('reads the public slug from a culture pathname', () => {
    expect(readSiteSlugFromPathname('/us', 'us')).toBe('');
    expect(readSiteSlugFromPathname('/us/about', 'us')).toBe('about');
    expect(readSiteSlugFromPathname('/us/notes-from-the-north-quay', 'us')).toBe('notes-from-the-north-quay');
  });

  it('uses short labels for known pages', () => {
    expect(siteNavLabel('', 'Harbor')).toBe('Home');
    expect(siteNavLabel('about', 'A studio that keeps the lights on')).toBe('About');
    expect(siteNavLabel('contact', 'Tell us what you are building')).toBe('Contact');
    expect(siteNavLabel('guide', 'Platform handbook')).toBe('Guide');
  });
});
