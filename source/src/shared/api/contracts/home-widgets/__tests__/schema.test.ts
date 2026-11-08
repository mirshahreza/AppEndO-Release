import { describe, expect, it } from 'vitest';
import { homeWidgetDefinitionSchema } from '../schema';

describe('homeWidgetDefinitionSchema', () => {
  it('accepts all span presets used by core Home widgets', () => {
    for (const span of ['full', 'wide', 'half', 'narrow', 'compact'] as const) {
      const parsed = homeWidgetDefinitionSchema.safeParse({
        componentRef: 'core:UsersHomeWidget',
        span,
        catalog: {
          labelKey: 'homeWidget.users.title',
          descriptionKey: 'homeWidget.users.description',
          icon: 'Users',
          tone: 'indigo',
        },
        deepLink: { pageKey: 'users' },
      });
      expect(parsed.success).toBe(true);
    }
  });
});
