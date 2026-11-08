import { describe, expect, it } from 'vitest';
import { applyDerivedMeasures, validateCubeAnnotation, CubeAnnotationError, type CubeAnnotation } from '../rolapStarSchemaCompiler';
import type { PivotResult, PivotSpec } from '../../../../shared/api/contracts/data-api';

describe('applyDerivedMeasures', () => {
  it('computes ratio from stored-column measures', () => {
    const spec: PivotSpec = {
      rows: [{ field: 'region' }],
      columns: [],
      measures: [
        { field: 'revenue', aggregation: 'sum' },
        { field: 'cost', aggregation: 'sum' },
        { field: 'margin', aggregation: 'sum' },
      ],
    };
    const result: PivotResult = {
      rowAxis: { fields: ['region'], members: [{ key: 'west', labels: ['West'] }] },
      colAxis: { fields: [], members: [{ key: '*', labels: [] }] },
      measures: spec.measures,
      cells: [{ rowKey: 'west', colKey: '*', values: [100, 40, null] }],
    };
    const annotation: CubeAnnotation = {
      factModelId: 'fact',
      measures: {
        revenue: { aggregation: 'sum', additivity: 'additive' },
        cost: { aggregation: 'sum', additivity: 'additive' },
      },
      dimensions: {},
      derivedMeasures: [
        { name: 'margin', operation: 'ratio', numerator: 'revenue', denominator: 'cost' },
      ],
    };
    const next = applyDerivedMeasures(result, spec, annotation);
    expect(next.cells[0]?.values[2]).toBe(2.5);
  });

  it('rejects derived measures that do not resolve to stored cubeMeasures', () => {
    const annotation: CubeAnnotation = {
      factModelId: 'fact',
      measures: {
        revenue: { aggregation: 'sum', additivity: 'additive' },
      },
      dimensions: {},
      derivedMeasures: [
        { name: 'margin', operation: 'ratio', numerator: 'revenue', denominator: 'cost' },
      ],
    };
    expect(() => validateCubeAnnotation(annotation)).toThrow(CubeAnnotationError);
  });
});
