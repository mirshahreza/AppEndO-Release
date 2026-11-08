import type { PivotResult, PivotSpec } from '../../../shared/api/contracts/data-api';
import { groupedRowsToPivotResult } from './pivotFlatDataset';

export type OlapCubeLevel = {
  name: string;
  uniqueName: string;
};

export type OlapCubeHierarchy = {
  name: string;
  uniqueName: string;
  levels: OlapCubeLevel[];
};

export type OlapCubeDimension = {
  name: string;
  uniqueName: string;
  hierarchies: OlapCubeHierarchy[];
};

export type OlapCubeMeasure = {
  name: string;
  uniqueName: string;
};

export type OlapCubeMetadata = {
  catalog: string;
  cube: string;
  language: 'MDX' | 'DAX';
  dimensions: OlapCubeDimension[];
  measures: OlapCubeMeasure[];
};

export type OlapBridgeQueryResult = {
  columns: Array<{ name: string; type?: string }>;
  rows: unknown[][];
};

const resolveField = (field: string, metadata: OlapCubeMetadata): string => {
  const measure = metadata.measures.find((item) => item.name === field || item.uniqueName === field);
  if (measure) {
    return measure.uniqueName;
  }
  for (const dimension of metadata.dimensions) {
    for (const hierarchy of dimension.hierarchies) {
      const level = hierarchy.levels.find((item) => item.name === field || item.uniqueName === field);
      if (level) {
        return level.uniqueName;
      }
      if (hierarchy.name === field || hierarchy.uniqueName === field) {
        return hierarchy.uniqueName;
      }
    }
  }
  throw new Error(`OLAP field "${field}" is not in the cube metadata.`);
};

const quoteMdx = (uniqueName: string): string => uniqueName;

export const compilePivotSpecToMdx = (spec: PivotSpec, metadata: OlapCubeMetadata): string => {
  const rowSet = spec.rows.length > 0
    ? spec.rows.map((item) => quoteMdx(resolveField(item.field, metadata))).join(' * ')
    : '{}';
  const colSet = spec.columns.length > 0
    ? spec.columns.map((item) => quoteMdx(resolveField(item.field, metadata))).join(' * ')
    : spec.measures.map((item) => quoteMdx(resolveField(item.field, metadata))).join(', ');
  const measureSet = spec.measures
    .map((item) => quoteMdx(resolveField(item.field, metadata)))
    .join(', ');
  const slicer = Object.entries(spec.filters ?? {}).map(([field, operators]) => {
    const eq = operators.eq;
    if (eq == null) {
      return null;
    }
    return `${quoteMdx(resolveField(field, metadata))}.[${String(eq)}]`;
  }).filter(Boolean);
  const where = slicer.length > 0 ? ` WHERE (${slicer.join(', ')})` : '';
  const columns = spec.columns.length > 0 ? `{${colSet}} * {${measureSet}}` : `{${measureSet}}`;
  return `SELECT ${columns} ON COLUMNS, ${rowSet} ON ROWS FROM [${metadata.cube}]${where}`;
};

export const compilePivotSpecToDax = (spec: PivotSpec, metadata: OlapCubeMetadata): string => {
  const groupFields = [...spec.rows, ...spec.columns].map((item) => resolveField(item.field, metadata));
  const summarize = groupFields.length > 0
    ? `SUMMARIZECOLUMNS(${groupFields.join(', ')}, ${spec.measures.map((item) => resolveField(item.field, metadata)).join(', ')})`
    : `ROW(${spec.measures.map((item, index) => `"m${index}", ${resolveField(item.field, metadata)}`).join(', ')})`;
  return `EVALUATE ${summarize}`;
};

export const compilePivotSpecToOlapStatement = (
  spec: PivotSpec,
  metadata: OlapCubeMetadata,
): { language: 'MDX' | 'DAX'; statement: string } => {
  if (metadata.language === 'DAX') {
    return { language: 'DAX', statement: compilePivotSpecToDax(spec, metadata) };
  }
  return { language: 'MDX', statement: compilePivotSpecToMdx(spec, metadata) };
};

export const olapBridgeRowsToPivotResult = (
  queryResult: OlapBridgeQueryResult,
  spec: PivotSpec,
): PivotResult => {
  const groupFields = [...spec.rows.map((item) => item.field), ...spec.columns.map((item) => item.field)];
  const documents = queryResult.rows.map((row) => {
    const record: Record<string, unknown> = {};
    groupFields.forEach((field, index) => {
      record[field] = row[index];
    });
    spec.measures.forEach((_, index) => {
      record[`m${index}`] = row[groupFields.length + index];
    });
    return record;
  });
  return groupedRowsToPivotResult(documents, spec);
};
