import { z } from 'zod';

export const SCHEMA_RELATIONS_DIAGRAM_LAYOUT_EXTENSION_KEY = 'schemaRelationsDiagramLayout';

/** Bump when default auto-layout changes so stale saved positions are ignored. */
export const SCHEMA_RELATIONS_DIAGRAM_LAYOUT_ALGORITHM_VERSION = 3;

export const schemaRelationsDiagramNodeLayoutSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive().optional(),
  height: z.number().finite().positive().optional(),
}).strict();

export const schemaRelationsDiagramLayoutSchema = z.object({
  algorithmVersion: z.number().int().positive().optional(),
  nodes: z.record(z.string(), schemaRelationsDiagramNodeLayoutSchema).default({}),
}).strict();

export type SchemaRelationsDiagramNodeLayout = z.infer<typeof schemaRelationsDiagramNodeLayoutSchema>;
export type SchemaRelationsDiagramLayout = z.infer<typeof schemaRelationsDiagramLayoutSchema>;

export const parseSchemaRelationsDiagramLayout = (
  value: unknown,
): SchemaRelationsDiagramLayout | null => {
  const parsed = schemaRelationsDiagramLayoutSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  if (
    parsed.data.algorithmVersion !== undefined
    && parsed.data.algorithmVersion !== SCHEMA_RELATIONS_DIAGRAM_LAYOUT_ALGORITHM_VERSION
  ) {
    return null;
  }
  // Legacy saves (no version) predate the fan layout — discard so the new auto-layout can apply.
  if (parsed.data.algorithmVersion === undefined) {
    return null;
  }
  return parsed.data;
};

export const readSchemaRelationsDiagramLayoutFromExtensions = (
  extensions: Record<string, unknown> | null | undefined,
): SchemaRelationsDiagramLayout | null => {
  if (!extensions) {
    return null;
  }
  return parseSchemaRelationsDiagramLayout(extensions[SCHEMA_RELATIONS_DIAGRAM_LAYOUT_EXTENSION_KEY]);
};

export const schemaRelationsDiagramLocalStorageKey = (
  dataSourceId: string,
  objectName: string,
): string => `append.schemaRelationsDiagram.${dataSourceId}.${objectName}`;

export const readSchemaRelationsDiagramLayoutFromLocalStorage = (
  dataSourceId: string,
  objectName: string,
): SchemaRelationsDiagramLayout | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(
      schemaRelationsDiagramLocalStorageKey(dataSourceId, objectName),
    );
    if (!raw) {
      return null;
    }
    return parseSchemaRelationsDiagramLayout(JSON.parse(raw));
  } catch {
    return null;
  }
};

const schemaRelationsDiagramShowEdgeLabelsKey = (
  dataSourceId: string,
  objectName: string,
): string => `append.schemaRelationsDiagram.edgeLabels.${dataSourceId}.${objectName}`;

export const readSchemaRelationsDiagramShowEdgeLabels = (
  dataSourceId: string,
  objectName: string,
): boolean => {
  if (typeof window === 'undefined') {
    return true;
  }
  try {
    const raw = window.localStorage.getItem(
      schemaRelationsDiagramShowEdgeLabelsKey(dataSourceId, objectName),
    );
    if (raw === '0' || raw === 'false') {
      return false;
    }
    return true;
  } catch {
    return true;
  }
};

export const writeSchemaRelationsDiagramShowEdgeLabels = (
  dataSourceId: string,
  objectName: string,
  show: boolean,
): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(
      schemaRelationsDiagramShowEdgeLabelsKey(dataSourceId, objectName),
      show ? '1' : '0',
    );
  } catch {
    // Silent — prefs must never interrupt the diagram UX.
  }
};

export const writeSchemaRelationsDiagramLayoutToLocalStorage = (
  dataSourceId: string,
  objectName: string,
  layout: SchemaRelationsDiagramLayout,
): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(
      schemaRelationsDiagramLocalStorageKey(dataSourceId, objectName),
      JSON.stringify(layout),
    );
  } catch {
    // Silent by design — layout persistence must never interrupt the diagram UX.
  }
};
