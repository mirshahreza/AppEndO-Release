import { describe, expect, it } from 'vitest';
import { parseCubeDerivedMeasures, upsertEdgeModelStudioMetaInputSchema } from '../studioMeta';

describe('studio-meta formWidget validation', () => {
  it('coerces empty formWidget to omitted Auto', () => {
    const parsed = upsertEdgeModelStudioMetaInputSchema.parse({
      columnMeta: [
        {
          columnName: 'amount',
          formWidget: '',
          group: 'Details',
          sortOrder: 1,
        },
      ],
    });
    expect(parsed.columnMeta?.[0]?.formWidget).toBeUndefined();
  });

  it('accepts a real form widget enum value', () => {
    const parsed = upsertEdgeModelStudioMetaInputSchema.parse({
      columnMeta: [
        {
          columnName: 'amount',
          formWidget: 'number',
        },
      ],
    });
    expect(parsed.columnMeta?.[0]?.formWidget).toBe('number');
  });

  it('parses cube derived measures from studio-meta extensions', () => {
    const parsed = parseCubeDerivedMeasures({
      cubeDerivedMeasures: [
        { name: 'margin', operation: 'ratio', numerator: 'revenue', denominator: 'cost' },
        { name: 'bad' },
      ],
    });
    expect(parsed).toEqual([
      { name: 'margin', operation: 'ratio', numerator: 'revenue', denominator: 'cost' },
    ]);
  });

  it('accepts association attachedFields with as names', () => {
    const parsed = upsertEdgeModelStudioMetaInputSchema.parse({
      associationMeta: [
        {
          relationKey: 'assoc_1',
          attachedFields: [
            { sourceColumn: 'title', as: 'content_type_code_title' },
            { sourceColumn: 'ui_color', as: 'content_type_code_ui_color' },
          ],
        },
      ],
    });
    expect(parsed.associationMeta?.[0]?.attachedFields).toEqual([
      { sourceColumn: 'title', as: 'content_type_code_title' },
      { sourceColumn: 'ui_color', as: 'content_type_code_ui_color' },
    ]);
  });

  it('backfills as from sourceColumn for legacy attachedFields rows', () => {
    const parsed = upsertEdgeModelStudioMetaInputSchema.parse({
      associationMeta: [
        {
          relationKey: 'assoc_1',
          attachedFields: [{ sourceColumn: 'title' }],
        },
      ],
    });
    expect(parsed.associationMeta?.[0]?.attachedFields).toEqual([
      { sourceColumn: 'title', as: 'title' },
    ]);
  });
});
