import { describe, expect, it } from 'vitest';
import { mergeShellHeaderModule } from '../mergeShellHeaderModule';

describe('mergeShellHeaderModule', () => {
  const baseContext = {
    item: {
      pageKey: 'workflows',
      label: 'Workflows',
      description: 'Author, validate, publish and simulate workflow definitions.',
      icon: 'Workflow',
      path: '/us/studio/workflows/edit/order-approval',
    },
    groupHeading: 'Ops',
    breadcrumbTrail: [{ label: 'Ops' }, { label: 'Workflows' }],
  };

  it('returns the base header when no override is provided', () => {
    expect(mergeShellHeaderModule(baseContext, null)).toEqual({
      pageKey: 'workflows',
      label: 'Workflows',
      description: 'Author, validate, publish and simulate workflow definitions.',
      icon: 'Workflow',
      path: '/us/studio/workflows/edit/order-approval',
      groupLabel: 'Ops',
      breadcrumbTrail: [{ label: 'Ops' }, { label: 'Workflows' }],
    });
  });

  it('replaces the shell title trail for nested editor pages and keeps nav group', () => {
    expect(mergeShellHeaderModule(baseContext, {
      label: 'Workflows',
      icon: 'Workflow',
      titleTrail: ['Workflows', 'Edit'],
    })).toMatchObject({
      label: 'Workflows',
      groupLabel: 'Ops',
      icon: 'Workflow',
      titleTrail: ['Workflows', 'Edit'],
    });
  });

  it('keeps nav group when override clears groupLabel without titleTrail', () => {
    expect(mergeShellHeaderModule(baseContext, {
      label: 'Workflows',
      groupLabel: null,
    })).toMatchObject({
      label: 'Workflows',
      groupLabel: 'Ops',
    });
  });

  it('allows groupLabel null when titleTrail carries the hierarchy', () => {
    expect(mergeShellHeaderModule(baseContext, {
      label: 'Circles',
      groupLabel: null,
      titleTrail: ['Area officials', 'Circles'],
    })).toMatchObject({
      groupLabel: null,
      titleTrail: ['Area officials', 'Circles'],
    });
  });
});
