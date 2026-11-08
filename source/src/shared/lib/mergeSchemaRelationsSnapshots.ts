import type {
  SchemaRelationEdge,
  SchemaRelationsSnapshot,
} from '../api/contracts/data-sources/schemaRelations';

const relationKey = (relation: SchemaRelationEdge): string => (
  `${relation.fromTable}.${relation.fromColumn}->${relation.toTable}.${relation.toColumn}`
);

/** Union tables/relations (expand peer onto an existing working snapshot). */
export function mergeSchemaRelationsSnapshots(
  base: SchemaRelationsSnapshot,
  addition: SchemaRelationsSnapshot,
): SchemaRelationsSnapshot {
  const tables = new Map(base.tables.map((table) => [table.name, table]));
  for (const table of addition.tables) {
    const existing = tables.get(table.name);
    if (!existing || table.columns.length > existing.columns.length) {
      tables.set(table.name, table);
    }
  }

  const relations = new Map(base.relations.map((relation) => [relationKey(relation), relation]));
  for (const relation of addition.relations) {
    relations.set(relationKey(relation), relation);
  }

  return {
    focusObject: base.focusObject,
    objectType: base.objectType,
    tables: [...tables.values()],
    relations: [...relations.values()],
  };
}

/**
 * Apply a fresh focus-object relations fetch onto a working diagram snapshot.
 * Server wins for any edge that touches the focus table (so dropped FKs stay gone);
 * keep expanded peer tables and peer↔peer relations from the working graph.
 */
export function reconcileFocusSchemaRelationsRefresh(
  server: SchemaRelationsSnapshot,
  working: SchemaRelationsSnapshot,
): SchemaRelationsSnapshot {
  const serverTableNames = new Set(server.tables.map((table) => table.name));
  const tables = new Map(server.tables.map((table) => [table.name, table]));
  for (const table of working.tables) {
    if (!serverTableNames.has(table.name)) {
      tables.set(table.name, table);
    }
  }

  const relations = new Map(server.relations.map((relation) => [relationKey(relation), relation]));
  for (const relation of working.relations) {
    if (
      relation.fromTable === server.focusObject
      || relation.toTable === server.focusObject
    ) {
      continue;
    }
    relations.set(relationKey(relation), relation);
  }

  return {
    focusObject: server.focusObject,
    objectType: server.objectType,
    tables: [...tables.values()],
    relations: [...relations.values()],
  };
}
