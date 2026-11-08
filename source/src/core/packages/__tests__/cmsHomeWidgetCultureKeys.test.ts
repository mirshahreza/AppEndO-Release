import { describe, expect, it } from 'vitest';
import { CMS_HOME_WIDGET_CULTURE_KEYS } from '../cmsHomeWidgetCultureKeys';

describe('CMS_HOME_WIDGET_CULTURE_KEYS', () => {
  it('includes review queue widget copy', () => {
    expect(CMS_HOME_WIDGET_CULTURE_KEYS['homeWidget.cmsContentsList.reviewQueue.title']).toBe('CMS awaiting review');
    expect(CMS_HOME_WIDGET_CULTURE_KEYS['homeWidget.cmsContentsList.reviewQueue.empty']).toContain('draft');
  });
});
