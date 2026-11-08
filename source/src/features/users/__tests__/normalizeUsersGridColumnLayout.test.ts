import { describe, expect, it } from 'vitest';
import { APP_TABLE_GRID_AUDIT_COLUMN_WIDTH } from '../../../shared/ui/surfaceClasses';
import { normalizeUsersGridColumnLayout } from '../userGridColumns';

describe('normalizeUsersGridColumnLayout', () => {
  it('caps oversized persisted audit and account widths', () => {
    const layout = normalizeUsersGridColumnLayout({
      order: ['email', 'created_at', 'updated_at', 'actions'],
      hidden: [],
      widths: {
        email: 400,
        created_at: 220,
        updated_at: 220,
        roles: 140,
      },
    });

    expect(layout.widths.email).toBe(240);
    expect(layout.widths.created_at).toBe(APP_TABLE_GRID_AUDIT_COLUMN_WIDTH);
    expect(layout.widths.updated_at).toBe(APP_TABLE_GRID_AUDIT_COLUMN_WIDTH);
    expect(layout.widths.roles).toBe(88);
  });

  it('moves login_as before actions when it was stored after actions', () => {
    const layout = normalizeUsersGridColumnLayout({
      order: ['email', 'actions', 'login_as'],
      hidden: [],
      widths: {},
    });

    expect(layout.order.indexOf('login_as')).toBeLessThan(layout.order.indexOf('actions'));
  });
});
