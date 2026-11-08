import { describe, expect, it } from 'vitest';
import type { ProductIdeaListItem } from '../../../shared/api/contracts/idea-foundry/types';
import {
  compareIdeasForHeatmap,
  resolveIdeaCardChrome,
} from '../ideaFoundryCatalog';

const idea = (
  patch: Partial<ProductIdeaListItem> & Pick<ProductIdeaListItem, 'id' | 'maturity'>,
): ProductIdeaListItem => ({
  title: patch.id,
  description: '',
  icon: null,
  importance: 'medium',
  scale: 'small',
  targetKind: 'new-package',
  packageId: null,
  packageTitle: null,
  sectionKey: null,
  sectionTitle: null,
  frontOffice: '',
  backOffice: '',
  note: null,
  decisionMaker: null,
  collaborators: [],
  models: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: 1,
  createdByUsername: 'admin',
  updatedAt: patch.updatedAt ?? '2026-01-01T00:00:00.000Z',
  updatedBy: 1,
  updatedByUsername: 'admin',
  ...patch,
});

describe('ideaFoundryCatalog', () => {
  it('tints tiles by stage', () => {
    const defining = resolveIdeaCardChrome({
      maturity: 'defining',
      targetKind: 'new-package',
      importance: 'medium',
      scale: 'small',
    });
    const ready = resolveIdeaCardChrome({
      maturity: 'ready-to-use',
      targetKind: 'existing-package',
      importance: 'high',
      scale: 'large',
    });
    expect(defining.barClass).toContain('slate');
    expect(ready.barClass).toContain('emerald');
    expect(ready.barWidthClass).toBe(defining.barWidthClass);
    expect(defining.shellClass).toContain('bg-slate-50/40');
    expect(ready.shellClass).toContain('bg-emerald-50/35');
    expect(ready.shellClass).not.toContain('ring-1');
  });

  it('sorts newer ideas ahead of older ones', () => {
    const older = idea({ id: 'a', maturity: 'defining', updatedAt: '2026-08-01T00:00:00.000Z' });
    const newer = idea({ id: 'b', maturity: 'in-production', updatedAt: '2026-08-30T00:00:00.000Z' });
    const ranked = [older, newer].sort(compareIdeasForHeatmap);
    expect(ranked.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('sorts by title, stage, and importance when asked', async () => {
    const { compareIdeas } = await import('../ideaFoundryCatalog');
    const alpha = idea({ id: 'a', title: 'Alpha', maturity: 'ready-to-use', importance: 'low' });
    const beta = idea({ id: 'b', title: 'Beta', maturity: 'defining', importance: 'critical' });
    expect([alpha, beta].sort((left, right) => compareIdeas(left, right, 'title', 'asc')).map((item) => item.id))
      .toEqual(['a', 'b']);
    expect([alpha, beta].sort((left, right) => compareIdeas(left, right, 'maturity', 'asc')).map((item) => item.id))
      .toEqual(['b', 'a']);
    expect([alpha, beta].sort((left, right) => compareIdeas(left, right, 'importance', 'desc')).map((item) => item.id))
      .toEqual(['b', 'a']);
  });

  it('labels new packages and existing package sections for the heatmap tile', async () => {
    const { formatIdeaHomeLabel } = await import('../ideaFoundryCatalog');
    expect(formatIdeaHomeLabel({
      targetKind: 'new-package',
      packageTitle: null,
      sectionTitle: null,
    })).toBe('New package');
    expect(formatIdeaHomeLabel({
      targetKind: 'existing-package',
      packageTitle: 'CMS',
      sectionTitle: 'Contents',
    })).toBe('CMS · Contents');
    expect(formatIdeaHomeLabel({
      targetKind: 'existing-package',
      packageTitle: 'CMS',
      sectionKey: 'whole-package',
      sectionTitle: 'Whole package',
    })).toBe('CMS');
  });

  it('uses Lightbulb when an idea has no icon', async () => {
    const { DEFAULT_IDEA_ICON, resolveIdeaIconRef } = await import('../ideaFoundryCatalog');
    expect(DEFAULT_IDEA_ICON).toBe('lucide:Lightbulb');
    expect(resolveIdeaIconRef(null)).toBe('lucide:Lightbulb');
    expect(resolveIdeaIconRef('  ')).toBe('lucide:Lightbulb');
    expect(resolveIdeaIconRef('lucide:Moon')).toBe('lucide:Moon');
  });

  it('maps the package catalog into domain homes when the dedicated homes list is empty', async () => {
    const { homesFromPackageCatalog } = await import('../ideaFoundryCatalog');
    const homes = homesFromPackageCatalog([
      { packageId: 'cms', displayName: 'CMS' },
      { packageId: 'cms', displayName: 'CMS' },
      { packageId: 'crm', displayName: 'CRM' },
    ]);
    expect(homes.map((home) => home.packageId)).toEqual(['cms', 'crm']);
    expect(homes.find((home) => home.packageId === 'cms')?.sections[0]?.key).toBe('whole-package');
  });

  it('gives every domain option its own tone and a multi-line description', async () => {
    const { IDEA_TARGET_KIND_OPTIONS } = await import('../ideaFoundryCatalog');
    expect(new Set(IDEA_TARGET_KIND_OPTIONS.map((option) => option.tone)).size).toBe(IDEA_TARGET_KIND_OPTIONS.length);
    for (const option of IDEA_TARGET_KIND_OPTIONS) {
      expect(option.description).toContain('\n');
    }
  });

  it('gives every importance and scale option its own tone and a multi-line description', async () => {
    const { IDEA_IMPORTANCE_OPTIONS, IDEA_SCALE_OPTIONS } = await import('../ideaFoundryCatalog');
    expect(new Set(IDEA_IMPORTANCE_OPTIONS.map((option) => option.tone)).size).toBe(IDEA_IMPORTANCE_OPTIONS.length);
    expect(new Set(IDEA_SCALE_OPTIONS.map((option) => option.tone)).size).toBe(IDEA_SCALE_OPTIONS.length);
    for (const option of [...IDEA_IMPORTANCE_OPTIONS, ...IDEA_SCALE_OPTIONS]) {
      expect(option.description).toContain('\n');
    }
  });

  it('promotes a model to lead and keeps the previous lead as supporting', async () => {
    const { withLeadModel } = await import('../ideaFoundryCatalog');
    const workshop = { id: 'model-1', name: 'Workshop model' };
    const backup = { id: 'model-2', name: 'Backup model' };
    const extra = { id: 'model-3', name: 'Spare model' };
    expect(withLeadModel([workshop, backup, extra], backup)).toEqual([backup, workshop, extra]);
    expect(withLeadModel([workshop], extra)).toEqual([extra, workshop]);
    expect(withLeadModel([workshop], workshop)).toEqual([workshop]);
  });

  it('maps a record to a write payload when team is complete', async () => {
    const { toIdeaWriteInput } = await import('../ideaFoundryCatalog');
    const record = idea({
      id: 'idea-1',
      maturity: 'defining',
      title: 'Night-shift board',
      description: 'Clerks reconcile pick lists.',
      frontOffice: 'Guest scans a barcode.',
      backOffice: 'Clerk confirms the pick.',
      decisionMaker: { userId: 1, displayName: 'Ada', username: 'ada', avatarUrl: null },
      models: [{ id: 'model-1', name: 'Workshop model' }],
    });
    expect(toIdeaWriteInput(record)).toMatchObject({
      title: 'Night-shift board',
      description: 'Clerks reconcile pick lists.',
      frontOffice: 'Guest scans a barcode.',
      backOffice: 'Clerk confirms the pick.',
      decisionMaker: { userId: 1 },
      models: [{ id: 'model-1' }],
    });
    expect(toIdeaWriteInput(idea({ id: 'idea-2', maturity: 'defining' }))).toBeNull();
  });
});
