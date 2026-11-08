import { describe, expect, it } from 'vitest';
import { executeDraftComponentLayout } from '../draftComponentLayout';

describe('executeDraftComponentLayout', () => {
  it('creates a CRUD template draft from templateId', async () => {
    const result = await executeDraftComponentLayout({
      name: 'Roles CRUD',
      templateId: 'roles',
      folder: 'admin',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.layoutId).toBeTruthy();
      expect(result.data?.name).toBe('Roles CRUD');
      expect(result.data?.folder).toBe('admin');
      expect((result.data?.nodeCount ?? 0) > 0).toBe(true);
    }
  });

  it('requires a component name', async () => {
    const result = await executeDraftComponentLayout({ name: '   ' });
    expect(result.ok).toBe(false);
  });
});
