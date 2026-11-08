import { z } from 'zod';

export const schemaObjectListItemSchema = z.object({
  name: z.string().min(1),
  columnCount: z.number().int().nonnegative(),
  primaryKey: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).nullable(),
});

export type SchemaObjectListItem = z.infer<typeof schemaObjectListItemSchema>;

const parseNonNegativeInt = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed));
    }
  }

  return null;
};

export const parseSchemaObjectPrimaryKey = (value: unknown): string | string[] | null => {
  if (typeof value === 'string' && value.trim()) {
    const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) {
      return null;
    }
    return parts.length === 1 ? parts[0] : parts;
  }

  if (Array.isArray(value)) {
    const parts = value
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .map((part) => part.trim());
    if (parts.length === 0) {
      return null;
    }
    return parts.length === 1 ? parts[0] : parts;
  }

  return null;
};

export const normalizeSchemaObjectListItem = (item: unknown): SchemaObjectListItem | null => {
  if (typeof item === 'string' && item.trim()) {
    return {
      name: item.trim(),
      columnCount: 0,
      primaryKey: null,
    };
  }

  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return null;
  }

  const record = item as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!name) {
    return null;
  }

  const columnCount = parseNonNegativeInt(record.columnCount)
    ?? parseNonNegativeInt(record.column_count)
    ?? 0;

  const primaryKey = parseSchemaObjectPrimaryKey(record.primaryKey)
    ?? parseSchemaObjectPrimaryKey(record.primary_key);

  return {
    name,
    columnCount,
    primaryKey,
  };
};

export const normalizeSchemaObjectListItems = (items: unknown): SchemaObjectListItem[] => (
  Array.isArray(items)
    ? items.map(normalizeSchemaObjectListItem).filter((item): item is SchemaObjectListItem => item !== null)
    : []
);
