import type { DataStudioExplorerObjectKind } from '../types';

/** MIME type for dragging schema objects onto the Relations diagram. */
export const SCHEMA_OBJECT_DRAG_MIME = 'application/x-appendo-schema-object';

export type SchemaObjectDragPayload = {
  dataSourceId: string;
  objectName: string;
  objectKind: DataStudioExplorerObjectKind;
  edgeModelId: string | null;
};

export const writeSchemaObjectDragPayload = (
  dataTransfer: DataTransfer,
  payload: SchemaObjectDragPayload,
): void => {
  dataTransfer.setData(SCHEMA_OBJECT_DRAG_MIME, JSON.stringify(payload));
  dataTransfer.setData('text/plain', payload.objectName);
  dataTransfer.effectAllowed = 'copy';
};

export const readSchemaObjectDragPayload = (
  dataTransfer: DataTransfer,
): SchemaObjectDragPayload | null => {
  const raw = dataTransfer.getData(SCHEMA_OBJECT_DRAG_MIME);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as SchemaObjectDragPayload;
    if (
      typeof parsed?.dataSourceId !== 'string'
      || typeof parsed?.objectName !== 'string'
      || typeof parsed?.objectKind !== 'string'
    ) {
      return null;
    }
    return {
      dataSourceId: parsed.dataSourceId,
      objectName: parsed.objectName,
      objectKind: parsed.objectKind,
      edgeModelId: typeof parsed.edgeModelId === 'string' ? parsed.edgeModelId : null,
    };
  } catch {
    return null;
  }
};
