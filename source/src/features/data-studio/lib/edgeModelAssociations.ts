import type {
  EdgeModelAssociation,
  EdgeModelColumn,
  EdgeModelDefinition,
} from '../../../shared/api/contracts/data-api';
import type { SchemaRelationEdge } from '../../../shared/api/contracts/data-sources/schemaRelations';

export type AssociationKind = EdgeModelAssociation['kind'];

export type AssociationDraftInput = {
  kind: AssociationKind;
  targetModelId: string;
  foreignKey: string;
  as: string;
  throughModelId?: string;
  otherKey?: string;
};

export type PhysicalRelationSuggestion = {
  kind: Exclude<AssociationKind, 'belongsToMany'>;
  targetModelId: string;
  foreignKey: string;
  as: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  constraintName?: string;
};

const ASSOCIATION_KIND_LABELS: Record<AssociationKind, string> = {
  belongsTo: 'Belongs to',
  hasOne: 'Has one',
  hasMany: 'Has many',
  belongsToMany: 'Belongs to many',
};

export const ASSOCIATION_KIND_OPTIONS: Array<{
  value: AssociationKind;
  label: string;
  description: string;
}> = [
  {
    value: 'belongsTo',
    label: ASSOCIATION_KIND_LABELS.belongsTo,
    description:
      'Form: a single lookup to one related parent (pick one record). This model stores the foreign-key column pointing at the target.',
  },
  {
    value: 'hasOne',
    label: ASSOCIATION_KIND_LABELS.hasOne,
    description:
      'Form: one nested related record (at most one child card/section). The foreign-key column lives on the target model.',
  },
  {
    value: 'hasMany',
    label: ASSOCIATION_KIND_LABELS.hasMany,
    description:
      'Form: a list/grid of related child records. The foreign-key column lives on the target model.',
  },
  {
    value: 'belongsToMany',
    label: ASSOCIATION_KIND_LABELS.belongsToMany,
    description:
      'Form: a multi-select collection of related records via a junction table. Foreign-key columns live on the through Edge model (Data API includes / Sequelize).',
  },
];

export const associationKindLabel = (kind: AssociationKind): string => (
  ASSOCIATION_KIND_LABELS[kind] ?? kind
);

export const associationSourceLabel = (source: EdgeModelAssociation['source']): string => {
  switch (source) {
    case 'catalog':
      return 'From database';
    case 'enricher':
      return 'Enricher';
    case 'manual':
    default:
      return 'Logical';
  }
};

export const isBelongsToManyAssociation = (
  association: Pick<EdgeModelAssociation, 'kind'>,
): association is Extract<EdgeModelAssociation, { kind: 'belongsToMany' }> => (
  association.kind === 'belongsToMany'
);

/**
 * True when a physical FK is a through-table leg of a belongsToMany on the focus model.
 * Those legs must not appear as separate Has-many rows (undirected self-M2M especially
 * would otherwise show two identical-looking Physical relations for content_id_a/b).
 */
export const isPhysicalFkCoveredByBelongsToMany = (args: {
  relation: Pick<SchemaRelationEdge, 'fromTable' | 'fromColumn' | 'toTable'>;
  focusObjectName: string;
  associations: ReadonlyArray<EdgeModelAssociation>;
  models: ReadonlyArray<Pick<EdgeModelDefinition, 'id' | 'objectName'>>;
}): boolean => {
  const modelById = new Map(args.models.map((model) => [model.id, model] as const));
  for (const association of args.associations) {
    if (!isBelongsToManyAssociation(association)) {
      continue;
    }
    const through = modelById.get(association.throughModelId);
    const target = modelById.get(association.targetModelId);
    if (!through || !target) {
      continue;
    }
    if (args.relation.fromTable !== through.objectName) {
      continue;
    }
    const isThroughKey = args.relation.fromColumn === association.foreignKey
      || args.relation.fromColumn === association.otherKey;
    if (!isThroughKey) {
      continue;
    }
    if (
      args.relation.toTable === args.focusObjectName
      || args.relation.toTable === target.objectName
    ) {
      return true;
    }
  }
  return false;
};

/** Where the FK column lives for direct association kinds (not belongsToMany). */
export const foreignKeyOwnerForKind = (
  kind: AssociationKind,
): 'source' | 'target' | 'through' => {
  if (kind === 'belongsToMany') {
    return 'through';
  }
  return kind === 'belongsTo' ? 'source' : 'target';
};

/** Nature convert / physical twin matching only apply to direct FK associations. */
export const supportsPhysicalNatureConversion = (
  kind: AssociationKind,
): boolean => kind !== 'belongsToMany';

export const createAssociationId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `assoc_${crypto.randomUUID()}`;
  }
  return `assoc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const toAliasToken = (value: string): string => (
  value
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
);

const singularishToken = (value: string): string => {
  const token = toAliasToken(value).toLowerCase();
  return token.replace(/s$/i, '') || token;
};

/** Preferred junction FK column name for a referenced table (e.g. users → user_id). */
export const preferredForeignKeyColumnName = (referencedObjectName: string): string => {
  const singular = singularishToken(referencedObjectName) || 'related';
  return `${singular}_id`;
};

/** Suggest a unique through/junction table name (e.g. products + roles → product_roles). */
export const suggestThroughTableName = (
  sourceObjectName: string,
  targetObjectName: string,
  existingObjectNames: ReadonlySet<string>,
): string => {
  const source = singularishToken(sourceObjectName) || 'source';
  const target = toAliasToken(targetObjectName).toLowerCase() || 'target';
  const preferred = `${source}_${target}`.slice(0, 128);
  if (!existingObjectNames.has(preferred)) {
    return preferred;
  }
  let index = 2;
  while (existingObjectNames.has(`${preferred}_${index}`)) {
    index += 1;
  }
  return `${preferred}_${index}`.slice(0, 128);
};

export const resolveModelPrimaryKey = (
  model: Pick<EdgeModelDefinition, 'primaryKey' | 'columns'>,
): { columnName: string; dataType: string } | null => {
  if (typeof model.primaryKey === 'string' && model.primaryKey.trim()) {
    const columnName = model.primaryKey.trim();
    const column = model.columns.find((item) => item.name === columnName);
    return {
      columnName,
      dataType: column?.dataType?.trim() || 'bigint',
    };
  }
  if (Array.isArray(model.primaryKey) && model.primaryKey.length > 0) {
    const columnName = model.primaryKey[0]?.trim();
    if (columnName) {
      const column = model.columns.find((item) => item.name === columnName);
      return {
        columnName,
        dataType: column?.dataType?.trim() || 'bigint',
      };
    }
  }
  const marked = model.columns.find((column) => column.isPrimaryKey);
  if (marked?.name?.trim()) {
    return {
      columnName: marked.name.trim(),
      dataType: marked.dataType?.trim() || 'bigint',
    };
  }
  return null;
};

const isCollectionKind = (kind: AssociationKind): boolean => (
  kind === 'hasMany' || kind === 'belongsToMany'
);

/**
 * Derive a readable include-alias stem from an FK column
 * (`content_type_code` → `content_type`, `customerId` → `customer`).
 */
export const aliasStemFromForeignKey = (foreignKey: string): string => {
  const token = toAliasToken(foreignKey);
  if (!token) {
    return '';
  }
  const lower = token.toLowerCase();
  if (lower === 'id' || lower === 'code') {
    return '';
  }

  let stem = token;
  if (/_codes?$/i.test(stem)) {
    stem = stem.replace(/_codes?$/i, '');
  } else if (/_ids?$/i.test(stem)) {
    stem = stem.replace(/_ids?$/i, '');
  } else if (/Codes?$/.test(stem)) {
    stem = stem.replace(/Codes?$/, '');
  } else if (/Ids?$/.test(stem)) {
    stem = stem.replace(/Ids?$/, '');
  } else {
    return '';
  }

  stem = toAliasToken(stem);
  const normalized = stem.toLowerCase();
  if (!stem || normalized === 'id' || normalized === 'code') {
    return '';
  }
  return stem;
};

export const suggestAssociationAlias = (
  kind: AssociationKind,
  targetObjectName: string,
  existingAliases: ReadonlySet<string>,
  foreignKey?: string,
): string => {
  const fromFk = kind === 'belongsTo'
    ? aliasStemFromForeignKey(foreignKey ?? '')
    : '';
  const baseRaw = toAliasToken(fromFk || targetObjectName) || 'related';
  const singularish = baseRaw.replace(/s$/i, '') || baseRaw;
  const preferred = isCollectionKind(kind)
    ? baseRaw
    : singularish;

  const candidates = isCollectionKind(kind)
    ? [preferred, `${preferred}_list`, `${preferred}_items`]
    : [preferred, `${preferred}_ref`, `${preferred}_item`];

  for (const candidate of candidates) {
    if (!existingAliases.has(candidate)) {
      return candidate;
    }
  }

  let index = 2;
  while (existingAliases.has(`${preferred}_${index}`)) {
    index += 1;
  }
  return `${preferred}_${index}`;
};

export const resolveForeignKeyColumnOptions = (args: {
  kind: AssociationKind;
  sourceColumns: ReadonlyArray<Pick<EdgeModelColumn, 'name'>>;
  targetColumns: ReadonlyArray<Pick<EdgeModelColumn, 'name'>>;
  throughColumns?: ReadonlyArray<Pick<EdgeModelColumn, 'name'>>;
}): string[] => {
  const owner = foreignKeyOwnerForKind(args.kind);
  const columns = owner === 'source'
    ? args.sourceColumns
    : owner === 'target'
      ? args.targetColumns
      : (args.throughColumns ?? []);
  return columns.map((column) => column.name);
};

/** Prefer `{table}_id` / singular `_id` when present on the FK-owning side. */
export const suggestForeignKeyColumn = (
  columnNames: ReadonlyArray<string>,
  referencedObjectName: string,
): string => {
  if (columnNames.length === 0) {
    return '';
  }
  const base = referencedObjectName.trim().toLowerCase();
  if (!base) {
    return columnNames.length === 1 ? columnNames[0] : '';
  }
  const singular = base.replace(/s$/i, '') || base;
  const candidates = [`${base}_id`, `${singular}_id`];
  for (const candidate of candidates) {
    if (columnNames.includes(candidate)) {
      return candidate;
    }
  }
  const fuzzy = columnNames.find((name) => (
    name === `${base}id`
    || name === `${singular}id`
    || name.endsWith(`_${singular}_id`)
  ));
  return fuzzy || (columnNames.length === 1 ? columnNames[0] : '');
};

export const resolveAssociationTargetModelId = (args: {
  targetModelId: string;
  /** Object name fallback when the draft stored a name (or id drifted). */
  targetObjectName?: string | null;
  peers: ReadonlyArray<Pick<EdgeModelDefinition, 'id' | 'objectName'>>;
  sourceModelId?: string;
}): string | null => {
  const trimmedId = args.targetModelId.trim();
  const trimmedName = args.targetObjectName?.trim() || '';

  if (trimmedId) {
    const byId = args.peers.find((model) => (
      model.id === trimmedId
      && model.id !== args.sourceModelId
    ));
    if (byId) {
      return byId.id;
    }
    const byIdAsName = args.peers.find((model) => (
      model.objectName === trimmedId
      && model.id !== args.sourceModelId
    ));
    if (byIdAsName) {
      return byIdAsName.id;
    }
  }

  if (trimmedName) {
    const parenMatch = trimmedName.match(/\(([^)]+)\)\s*$/);
    const objectName = (parenMatch?.[1] || trimmedName).trim();
    const byName = args.peers.find((model) => (
      model.objectName === objectName
      && model.id !== args.sourceModelId
    ));
    if (byName) {
      return byName.id;
    }
  }

  return null;
};

export const associationShapeKey = (
  association: Pick<
    EdgeModelAssociation,
    'kind' | 'targetModelId' | 'foreignKey'
  > & Partial<Pick<Extract<EdgeModelAssociation, { kind: 'belongsToMany' }>, 'throughModelId' | 'otherKey'>>,
): string => {
  if (association.kind === 'belongsToMany') {
    return [
      'belongsToMany',
      association.targetModelId,
      association.throughModelId ?? '',
      association.foreignKey,
      association.otherKey ?? '',
    ].join('|');
  }
  return `${association.kind}|${association.targetModelId}|${association.foreignKey}`;
};

export const validateAssociationDraft = (
  input: AssociationDraftInput,
  options: {
    sourceModelId: string;
    existing: ReadonlyArray<Pick<EdgeModelAssociation, 'id' | 'as'> & Partial<EdgeModelAssociation>>;
    editingId?: string;
    foreignKeyOptions: ReadonlyArray<string>;
    otherKeyOptions?: ReadonlyArray<string>;
    targetModelIds: ReadonlySet<string>;
    throughModelIds?: ReadonlySet<string>;
  },
): string | null => {
  const alias = input.as.trim();
  const foreignKey = input.foreignKey.trim();
  const otherKey = input.otherKey?.trim() ?? '';
  const throughModelId = input.throughModelId?.trim() ?? '';

  if (!input.targetModelId) {
    return 'Select a target model.';
  }
  if (!options.targetModelIds.has(input.targetModelId)) {
    return 'Target model is not available on this data source.';
  }

  if (input.kind === 'belongsToMany') {
    if (!throughModelId) {
      return 'Select a through (junction) Edge model.';
    }
    if (!options.throughModelIds?.has(throughModelId)) {
      return 'Through model is not available on this data source.';
    }
    if (throughModelId === options.sourceModelId || throughModelId === input.targetModelId) {
      return 'Through model must be different from the source and target models.';
    }
    if (!foreignKey) {
      return 'Select the through column that points at this model.';
    }
    if (!otherKey) {
      return 'Select the through column that points at the target model.';
    }
    if (foreignKey === otherKey) {
      return 'Foreign key and other key must be different columns on the through model.';
    }
    if (options.foreignKeyOptions.length > 0 && !options.foreignKeyOptions.includes(foreignKey)) {
      return 'Foreign-key column is not available on the through model.';
    }
    if (
      options.otherKeyOptions
      && options.otherKeyOptions.length > 0
      && !options.otherKeyOptions.includes(otherKey)
    ) {
      return 'Other-key column is not available on the through model.';
    }
  } else {
    if (!foreignKey) {
      return 'Select a foreign-key column.';
    }
    if (options.foreignKeyOptions.length > 0 && !options.foreignKeyOptions.includes(foreignKey)) {
      return 'Foreign-key column is not available for this relation kind.';
    }
  }

  if (!alias) {
    return 'Enter an include alias.';
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) {
    return 'Alias must start with a letter or underscore and use only letters, numbers, and underscores.';
  }
  const duplicateAlias = options.existing.some((item) => (
    item.as === alias && item.id !== options.editingId
  ));
  if (duplicateAlias) {
    return `Alias "${alias}" is already used on this model.`;
  }

  const draftKey = associationShapeKey({
    kind: input.kind,
    targetModelId: input.targetModelId,
    foreignKey,
    ...(input.kind === 'belongsToMany'
      ? { throughModelId, otherKey }
      : {}),
  });
  const duplicateShape = options.existing.some((item) => (
    item.id !== options.editingId
    && associationShapeKey(item as EdgeModelAssociation) === draftKey
  ));
  if (duplicateShape) {
    return 'An equivalent relation already exists on this model.';
  }

  return null;
};

export const buildManualAssociation = (
  input: AssociationDraftInput,
  id?: string,
): EdgeModelAssociation => {
  const shared = {
    id: id ?? createAssociationId(),
    targetModelId: input.targetModelId,
    foreignKey: input.foreignKey.trim(),
    as: input.as.trim(),
    source: 'manual' as const,
  };

  if (input.kind === 'belongsToMany') {
    return {
      ...shared,
      kind: 'belongsToMany',
      throughModelId: (input.throughModelId ?? '').trim(),
      otherKey: (input.otherKey ?? '').trim(),
    };
  }

  return {
    ...shared,
    kind: input.kind,
  };
};

/**
 * Suggest logical associations from introspected FK edges for the focused object.
 * Outbound FKs → belongsTo; inbound FKs → hasMany.
 * Does not suggest belongsToMany (junction graphs are created explicitly).
 */
export const suggestAssociationsFromPhysicalRelations = (args: {
  focusObjectName: string;
  relations: ReadonlyArray<SchemaRelationEdge>;
  models: ReadonlyArray<Pick<EdgeModelDefinition, 'id' | 'objectName' | 'dataSourceId'>>;
  dataSourceId: string;
  existing: ReadonlyArray<Pick<EdgeModelAssociation, 'as' | 'kind' | 'targetModelId' | 'foreignKey'>>;
}): PhysicalRelationSuggestion[] => {
  const modelByObjectName = new Map<string, string>();
  for (const model of args.models) {
    if (model.dataSourceId !== args.dataSourceId) {
      continue;
    }
    modelByObjectName.set(model.objectName, model.id);
  }

  const existingKeys = new Set(
    args.existing.map((item) => associationShapeKey(item)),
  );
  const usedAliases = new Set(args.existing.map((item) => item.as));
  const suggestions: PhysicalRelationSuggestion[] = [];

  for (const relation of args.relations) {
    const outbound = relation.fromTable === args.focusObjectName;
    const inbound = relation.toTable === args.focusObjectName;
    if (!outbound && !inbound) {
      continue;
    }

    const targetObjectName = outbound ? relation.toTable : relation.fromTable;
    const targetModelId = modelByObjectName.get(targetObjectName);
    if (!targetModelId) {
      continue;
    }

    const kind: Exclude<AssociationKind, 'belongsToMany'> = outbound ? 'belongsTo' : 'hasMany';
    const foreignKey = relation.fromColumn;
    const dedupeKey = associationShapeKey({ kind, targetModelId, foreignKey });
    if (existingKeys.has(dedupeKey)) {
      continue;
    }

    const as = suggestAssociationAlias(kind, targetObjectName, usedAliases, foreignKey);
    usedAliases.add(as);
    existingKeys.add(dedupeKey);

    suggestions.push({
      kind,
      targetModelId,
      foreignKey,
      as,
      fromTable: relation.fromTable,
      fromColumn: relation.fromColumn,
      toTable: relation.toTable,
      toColumn: relation.toColumn,
      constraintName: relation.constraintName,
    });
  }

  return suggestions;
};

export const associationsFromSuggestions = (
  suggestions: ReadonlyArray<PhysicalRelationSuggestion>,
): EdgeModelAssociation[] => (
  suggestions.map((suggestion) => ({
    id: createAssociationId(),
    kind: suggestion.kind,
    targetModelId: suggestion.targetModelId,
    foreignKey: suggestion.foreignKey,
    as: suggestion.as,
    source: 'catalog' as const,
  }))
);
