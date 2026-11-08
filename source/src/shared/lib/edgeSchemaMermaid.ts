import type { SchemaRelationsSnapshot } from '../api/contracts/data-sources/schemaRelations';

const MERMAID_FIELD_TYPE_MAP: Record<string, string> = {
  boolean: 'boolean',
  bool: 'boolean',
  bit: 'boolean',
  int: 'int',
  integer: 'int',
  bigint: 'int',
  smallint: 'int',
  tinyint: 'int',
  serial: 'int',
  float: 'float',
  double: 'float',
  real: 'float',
  decimal: 'decimal',
  numeric: 'decimal',
  money: 'decimal',
  date: 'date',
  time: 'date',
  timestamp: 'datetime',
  datetime: 'datetime',
  json: 'json',
  jsonb: 'json',
  text: 'string',
  varchar: 'string',
  char: 'string',
  uuid: 'string',
};

const toMermaidEntityId = (tableName: string): string => {
  const safe = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[0-9]/.test(safe) ? `t_${safe}` : safe;
};

const toMermaidFieldType = (rawType: string): string => {
  const normalized = rawType.trim().toLowerCase();
  for (const [needle, mapped] of Object.entries(MERMAID_FIELD_TYPE_MAP)) {
    if (normalized.includes(needle)) {
      return mapped;
    }
  }
  return 'string';
};

const pickDiagramColumns = (
  table: SchemaRelationsSnapshot['tables'][number],
  compact: boolean,
) => {
  if (!compact) {
    return table.columns.slice(0, 8);
  }

  const primaryKeys = table.columns.filter((column) => column.isPrimaryKey);
  if (primaryKeys.length > 0) {
    return primaryKeys.slice(0, 2);
  }

  return table.columns.slice(0, 1);
};

export function buildEdgeSchemaMermaid(
  snapshot: SchemaRelationsSnapshot,
  options: { compact?: boolean } = {},
): string {
  const compact = options.compact ?? true;
  const entityIds = new Map<string, string>();

  for (const table of snapshot.tables) {
    entityIds.set(table.name, toMermaidEntityId(table.name));
  }

  const lines = ['erDiagram'];
  for (const table of snapshot.tables) {
    const entityId = entityIds.get(table.name) ?? toMermaidEntityId(table.name);
    const diagramColumns = pickDiagramColumns(table, compact);

    lines.push(`  ${entityId} {`);
    if (diagramColumns.length === 0) {
      lines.push('    entity string');
    } else {
      for (const column of diagramColumns) {
        const suffix = column.isPrimaryKey ? ' PK' : '';
        lines.push(`    ${column.name} ${toMermaidFieldType(column.dataType)}${suffix}`);
      }
    }
    lines.push('  }');
  }

  for (const relation of snapshot.relations) {
    const fromId = entityIds.get(relation.fromTable) ?? toMermaidEntityId(relation.fromTable);
    const toId = entityIds.get(relation.toTable) ?? toMermaidEntityId(relation.toTable);
    lines.push(`  ${fromId} }o--|| ${toId} : ${relation.fromColumn}`);
  }

  return lines.join('\n');
}
