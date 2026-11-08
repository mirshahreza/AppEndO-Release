import { describe, expect, it } from 'vitest';
import type { WorkflowDefinitionSummary } from '../types';
import {
  buildWorkflowEditRelativePath,
  buildWorkflowEditSlug,
  buildWorkflowListRelativePath,
  findWorkflowByEditSlug,
  isWorkflowDesignerPathname,
  isWorkflowListPathname,
  parseWorkflowEditSlug,
  parseWorkflowEditSlugFromPathname,
  pathnameMatchesWorkflowDesignerNavPath,
  resolveWorkflowItemLabelFromEditSlug,
  resolveWorkflowRouteSuffix,
  workflowDesignerNavPathFromListPath,
} from '../workflowRoute';

const definitions: WorkflowDefinitionSummary[] = [
  {
    id: 7,
    scopeKey: 'default',
    key: 'order-approval',
    lifecycleStatus: 'DRAFT',
    creationMode: 'BLANK',
    draftVersion: 2,
    currentPublishedRevisionId: null,
    stateVersion: 1,
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 12,
    scopeKey: 'default',
    key: 'invoice-flow',
    lifecycleStatus: 'ACTIVE',
    creationMode: 'BLANK',
    draftVersion: 5,
    currentPublishedRevisionId: 3,
    stateVersion: 4,
    updatedAt: '2026-07-02T00:00:00.000Z',
  },
];

describe('workflowRoute', () => {
  it('builds workflow key edit slugs', () => {
    expect(buildWorkflowEditSlug({ key: 'order-approval' })).toBe('order-approval');
  });

  it('parses designer route suffixes only from workflows/edit', () => {
    expect(resolveWorkflowRouteSuffix('studio/workflows')).toBeUndefined();
    expect(resolveWorkflowRouteSuffix('studio/workflows/order-approval')).toBeUndefined();
    expect(resolveWorkflowRouteSuffix('studio/workflows/edit')).toBeUndefined();
    expect(resolveWorkflowRouteSuffix('studio/workflows/edit/order-approval')).toBe('order-approval');
    expect(resolveWorkflowRouteSuffix('us/studio/workflows/edit/order-approval')).toBe('order-approval');
    expect(resolveWorkflowRouteSuffix('edit/order-approval')).toBe('order-approval');
    expect(resolveWorkflowRouteSuffix('workflows/edit/12')).toBe('12');
  });

  it('parses edit slugs from designer path suffixes', () => {
    expect(parseWorkflowEditSlug('studio/workflows/edit/order-approval')).toBe('order-approval');
    expect(parseWorkflowEditSlug('studio/workflows/order-approval')).toBeNull();
    expect(parseWorkflowEditSlug(undefined)).toBeNull();
  });

  it('resolves workflows by key or numeric id slug', () => {
    expect(findWorkflowByEditSlug(definitions, 'order-approval')?.id).toBe(7);
    expect(findWorkflowByEditSlug(definitions, '12')?.id).toBe(12);
    expect(findWorkflowByEditSlug(definitions, 'missing-workflow')).toBeNull();
  });

  it('builds bookmarkable relative paths', () => {
    expect(buildWorkflowListRelativePath()).toBe('workflows');
    expect(buildWorkflowEditRelativePath({ key: 'order-approval' })).toBe('workflows/edit/order-approval');
  });

  it('includes the studio portal segment for culture mounts', () => {
    expect(buildWorkflowListRelativePath('us')).toBe('studio/workflows');
    expect(buildWorkflowEditRelativePath({ key: 'order-approval' }, 'us')).toBe('studio/workflows/edit/order-approval');
  });

  it('detects list vs designer pathnames', () => {
    expect(isWorkflowListPathname('/us/studio/workflows')).toBe(true);
    expect(isWorkflowListPathname('/us/studio/workflows/edit/order-approval')).toBe(false);
    expect(isWorkflowDesignerPathname('/us/studio/workflows/edit/order-approval')).toBe(true);
    expect(isWorkflowDesignerPathname('/us/studio/workflows')).toBe(false);
  });

  it('maps workflows nav paths to designer editor paths', () => {
    expect(workflowDesignerNavPathFromListPath('/us/studio/workflows')).toBe('/us/studio/workflows/edit');
    expect(pathnameMatchesWorkflowDesignerNavPath(
      '/us/studio/workflows/edit/order-approval',
      '/us/studio/workflows',
    )).toBe(true);
  });

  it('parses edit slugs from full pathnames', () => {
    expect(parseWorkflowEditSlugFromPathname('/us/studio/workflows/edit/order-approval')).toBe('order-approval');
    expect(parseWorkflowEditSlugFromPathname('/us/studio/workflows')).toBeNull();
  });

  it('derives a display label from an edit slug before definitions load', () => {
    expect(resolveWorkflowItemLabelFromEditSlug('order-approval')).toBe('order-approval');
    expect(resolveWorkflowItemLabelFromEditSlug('saga-lifo-1784392614759-b6n00g')).toBe('saga-lifo-1784392614759-b6n00g');
  });
});
