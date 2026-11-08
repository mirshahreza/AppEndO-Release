import { describe, expect, it } from 'vitest';
import {
  buildContentStatusColoredAppearance,
  CONTENT_STATUS_OPTION_BUTTON_CLASS,
  resolveContentStatusOptionAppearance,
} from '../designerContentStatusTrigger';
import { buildContentStatusAuditMutationBody, partitionContentStatusPickerOptions } from '../DesignerRuntimeContentStatusPicker';

describe('designerContentStatusTrigger', () => {
  it('applies base-info uiColor to status option buttons', () => {
    const appearance = resolveContentStatusOptionAppearance('#10b981');

    expect(appearance.className).toBe(CONTENT_STATUS_OPTION_BUTTON_CLASS);
    expect(appearance.style).toMatchObject({
      borderColor: 'rgba(16, 185, 129, 0.38)',
      color: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.055)',
      '--status-option-hover-bg': 'rgba(16, 185, 129, 0.14)',
      '--status-option-hover-border': 'rgba(16, 185, 129, 0.62)',
    });
  });

  it('falls back to neutral chrome when uiColor is missing', () => {
    const appearance = buildContentStatusColoredAppearance(
      null,
      CONTENT_STATUS_OPTION_BUTTON_CLASS,
    );

    expect(appearance.className).toContain('border-slate-300');
    expect(appearance.className).toContain('w-full');
    expect(appearance.style).toBeUndefined();
  });

  it('stamps status changes with the current database actor fields', () => {
    expect(buildContentStatusAuditMutationBody(
      'published',
      { user: { id: 42 } },
      '2026-08-06T16:00:00.000Z',
    )).toEqual({
      statusCode: 'published',
      statusCodeUpdatedAt: '2026-08-06T16:00:00.000Z',
      statusCodeUpdatedBy: 42,
      updatedBy: 42,
      updatedAt: '2026-08-06T16:00:00.000Z',
    });

    expect(buildContentStatusAuditMutationBody(
      'archived',
      {},
      '2026-08-06T17:00:00.000Z',
      7,
    )).toMatchObject({
      statusCode: 'archived',
      statusCodeUpdatedBy: 7,
      updatedBy: 7,
    });
  });

  it('puts Published first and keeps the remaining statuses in source order', () => {
    expect(partitionContentStatusPickerOptions([
      { value: 'draft', label: 'Draft' },
      { value: 'in_review', label: 'In Review' },
      { value: '101.002.003', label: 'Published', shortName: 'published' },
      { value: 'archived', label: 'Archived' },
      { value: 'rejected', label: 'Rejected' },
    ])).toEqual({
      published: { value: '101.002.003', label: 'Published', shortName: 'published' },
      others: [
        { value: 'draft', label: 'Draft' },
        { value: 'in_review', label: 'In Review' },
        { value: 'archived', label: 'Archived' },
        { value: 'rejected', label: 'Rejected' },
      ],
    });
  });
});
