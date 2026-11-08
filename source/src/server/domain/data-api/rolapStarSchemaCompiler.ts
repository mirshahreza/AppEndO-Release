import type { PivotResult, PivotSpec } from '../../../shared/api/contracts/data-api';

export type CubeMeasureAdditivity = 'additive' | 'semi-additive';

export type CubeMeasureAnnotation = {
  aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'countDistinct' | 'lastNonEmpty';
  additivity: CubeMeasureAdditivity;
  semiAdditiveOverAssociation?: string;
};

export type CubeDimensionAnnotation = {
  hierarchies?: Array<{ name: string; levels: string[] }>;
  attributes?: string[];
  isTimeDimension?: boolean;
};

export type CubeDerivedMeasure = {
  name: string;
  operation: 'ratio' | 'difference' | 'percentDiff';
  numerator: string;
  denominator: string;
};

export type CubeAnnotation = {
  factModelId: string;
  measures: Record<string, CubeMeasureAnnotation>;
  dimensions: Record<string, CubeDimensionAnnotation>;
  derivedMeasures: CubeDerivedMeasure[];
};

export class CubeAnnotationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CubeAnnotationError';
  }
}

export const validateCubeAnnotation = (annotation: CubeAnnotation): void => {
  const measureNames = Object.keys(annotation.measures);
  if (measureNames.length === 0) {
    throw new CubeAnnotationError('A fact model must declare at least one cubeMeasure.');
  }

  const dimensionFieldNames = new Set<string>();
  for (const [asName, dimension] of Object.entries(annotation.dimensions)) {
    const hierarchies = dimension.hierarchies ?? [];
    const attributes = dimension.attributes ?? [];
    if (hierarchies.length === 0 && attributes.length === 0) {
      throw new CubeAnnotationError(`cubeDimension "${asName}" must declare a hierarchy or attributes.`);
    }
    const hierarchyColumns = new Set<string>();
    for (const hierarchy of hierarchies) {
      for (const level of hierarchy.levels) {
        if (hierarchyColumns.has(level) === false) {
          hierarchyColumns.add(level);
        }
        dimensionFieldNames.add(`${asName}.${level}`);
      }
    }
    for (const attribute of attributes) {
      if (hierarchyColumns.has(attribute)) {
        throw new CubeAnnotationError(`cubeDimension "${asName}" cannot use "${attribute}" as both hierarchy level and attribute.`);
      }
      dimensionFieldNames.add(`${asName}.${attribute}`);
    }
  }

  for (const [name, measure] of Object.entries(annotation.measures)) {
    if (measure.additivity === 'semi-additive') {
      if (measure.aggregation !== 'lastNonEmpty') {
        throw new CubeAnnotationError(`Semi-additive measure "${name}" must use lastNonEmpty.`);
      }
      const over = measure.semiAdditiveOverAssociation?.trim();
      if (!over || !annotation.dimensions[over]?.isTimeDimension) {
        throw new CubeAnnotationError(`Semi-additive measure "${name}" must reference a time dimension association.`);
      }
    }
  }

  if (annotation.derivedMeasures.length > 0 && measureNames.length < 2) {
    throw new CubeAnnotationError('Derived measures require at least two stored-column cubeMeasures.');
  }

  const reserved = new Set([...measureNames, ...dimensionFieldNames]);
  for (const derived of annotation.derivedMeasures) {
    if (reserved.has(derived.name)) {
      throw new CubeAnnotationError(`Derived measure name "${derived.name}" collides with an existing field.`);
    }
    if (derived.numerator === derived.denominator) {
      throw new CubeAnnotationError(`Derived measure "${derived.name}" numerator and denominator must be distinct.`);
    }
    if (!annotation.measures[derived.numerator] || !annotation.measures[derived.denominator]) {
      throw new CubeAnnotationError(`Derived measure "${derived.name}" operands must be stored-column cubeMeasures.`);
    }
    reserved.add(derived.name);
  }
};

export const applyDerivedMeasures = (
  result: PivotResult,
  spec: PivotSpec,
  annotation: CubeAnnotation,
): PivotResult => {
  const derivedRequested = spec.measures
    .map((measure, index) => ({ measure, index }))
    .filter((entry) => annotation.derivedMeasures.some((item) => item.name === entry.measure.field));
  if (derivedRequested.length === 0) {
    return result;
  }

  const measureIndex = new Map(result.measures.map((item, index) => [`${item.field}:${item.aggregation}`, index]));
  const findIndex = (field: string): number => {
    for (const [key, index] of measureIndex) {
      if (key.startsWith(`${field}:`)) {
        return index;
      }
    }
    return -1;
  };

  const cells = result.cells.map((cell) => {
    const values = [...cell.values];
    for (const entry of derivedRequested) {
      const derived = annotation.derivedMeasures.find((item) => item.name === entry.measure.field);
      if (!derived) {
        continue;
      }
      const numerator = values[findIndex(derived.numerator)];
      const denominator = values[findIndex(derived.denominator)];
      if (typeof numerator !== 'number' || typeof denominator !== 'number' || denominator === 0) {
        values[entry.index] = null;
        continue;
      }
      if (derived.operation === 'ratio') {
        values[entry.index] = numerator / denominator;
      } else if (derived.operation === 'difference') {
        values[entry.index] = numerator - denominator;
      } else {
        values[entry.index] = (numerator - denominator) / denominator;
      }
    }
    return { ...cell, values };
  });

  return { ...result, cells };
};

export const resolveStarSchemaField = (
  field: string,
  annotation: CubeAnnotation,
): { kind: 'measure' | 'derived' | 'dimension'; associationAs?: string; column?: string } => {
  if (annotation.measures[field]) {
    return { kind: 'measure', column: field };
  }
  if (annotation.derivedMeasures.some((item) => item.name === field)) {
    return { kind: 'derived' };
  }
  const [associationAs, column] = field.split('.', 2);
  if (associationAs && column && annotation.dimensions[associationAs]) {
    const dimension = annotation.dimensions[associationAs];
    const levels = (dimension.hierarchies ?? []).flatMap((item) => item.levels);
    const attributes = dimension.attributes ?? [];
    if (levels.includes(column) || attributes.includes(column)) {
      return { kind: 'dimension', associationAs, column };
    }
  }
  throw new CubeAnnotationError(`Pivot field "${field}" is not declared on this cube.`);
};
