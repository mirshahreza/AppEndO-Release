import type { SchemaFunctionKind, SchemaObjectType } from '../api/queries/data-sources';
import { assertSchemaObjectName } from './schemaObjectName';

const quotePg = (name: string) => `"${name.replace(/"/g, '""')}"`;
const quoteMySql = (name: string) => `\`${name.replace(/`/g, '``')}\``;
const quoteSqlServer = (name: string) => `[${name.replace(/]/g, ']]')}]`;

const startsWithCreate = (value: string): boolean => /^\s*CREATE\b/i.test(value);

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const expandPostgreSqlDollarQuotedBodies = (sql: string): string => (
  sql.replace(/\bAS\s+(\$[A-Za-z0-9_]*\$)([\s\S]*?)\1/g, (_match, tag, body) => (
    `AS ${tag}\n${body.trim()}\n${tag}`
  ))
);

export const formatPostgreSqlRoutineForEditor = (
  objectName: string,
  rawDefinition: string,
): string => {
  const quotedName = quotePg(objectName);
  let sql = expandPostgreSqlDollarQuotedBodies(rawDefinition.replace(/\r\n/g, '\n').trim());

  sql = sql.replace(
    new RegExp(`\\bpublic\\.${escapeRegExp(objectName)}\\b`, 'gi'),
    quotedName,
  );
  sql = sql.replace(
    new RegExp(
      `(CREATE(?:\\s+OR\\s+REPLACE)?\\s+(?:PROCEDURE|FUNCTION)\\s+)${escapeRegExp(objectName)}(?=\\s*\\()`,
      'gi',
    ),
    `$1${quotedName}`,
  );

  sql = sql.replace(/\n[ \t]*LANGUAGE\s+/gi, '\nLANGUAGE ');

  const simpleLanguageSqlMatch = sql.match(
    /^([\s\S]*?\bLANGUAGE\s+sql\s+)AS\s+\$[A-Za-z0-9_]*\$\s*([\s\S]*?)\s*\$[A-Za-z0-9_]*\$\s*$/i,
  );
  if (simpleLanguageSqlMatch) {
    const header = simpleLanguageSqlMatch[1].trimEnd();
    let body = simpleLanguageSqlMatch[2].trim();
    const isSimpleSingleStatement = body.length > 0
      && !body.includes('\n')
      && !body.includes("'")
      && !body.includes('$');
    if (isSimpleSingleStatement) {
      if (!body.endsWith(';')) {
        body = `${body};`;
      }
      sql = `${header}\nAS '${body}'`;
    }
  }

  return sql;
};

export const extractSchemaObjectDefinitionRow = (row: unknown): string | null => {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const record = row as Record<string, unknown>;
  let bestCreate: string | null = null;
  let bestNamed: string | null = null;
  let bestAny: string | null = null;

  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== 'string') {
      continue;
    }

    const text = value.trim();
    if (!text) {
      continue;
    }

    if (startsWithCreate(text) && (!bestCreate || text.length > bestCreate.length)) {
      bestCreate = text;
    }

    if (/definition|create|sql/i.test(key) && (!bestNamed || text.length > bestNamed.length)) {
      bestNamed = text;
    }

    if (!bestAny || text.length > bestAny.length) {
      bestAny = text;
    }
  }

  return bestCreate ?? bestNamed ?? bestAny;
};

export const normalizeSchemaObjectDefinition = (
  sourceType: string,
  objectType: SchemaObjectType,
  objectName: string,
  rawDefinition: string,
  functionKind?: SchemaFunctionKind,
): string => {
  const dialect = sourceType.trim();
  const name = assertSchemaObjectName(objectName);
  const definition = rawDefinition.trim();

  if (!definition) {
    throw new Error('Schema object definition is empty.');
  }

  if (startsWithCreate(definition)) {
    if (dialect === 'PostgreSQL' && (objectType === 'PROCEDURE' || objectType === 'FUNCTION')) {
      return formatPostgreSqlRoutineForEditor(name, definition);
    }
    return definition;
  }

  if (dialect === 'PostgreSQL') {
    if (objectType === 'VIEW') {
      if (startsWithCreate(definition)) {
        return definition;
      }
      return `CREATE OR REPLACE VIEW ${quotePg(name)} AS\n${definition}`;
    }
    if (objectType === 'PROCEDURE' || objectType === 'FUNCTION') {
      return formatPostgreSqlRoutineForEditor(name, definition);
    }
    return definition;
  }

  if (dialect === 'SQLite') {
    if (objectType === 'VIEW') {
      if (/^\s*SELECT\b/i.test(definition)) {
        return `CREATE VIEW ${name} AS\n${definition}`;
      }
    }
    return definition;
  }

  if (dialect === 'MySQL') {
    if (objectType === 'VIEW') {
      return `CREATE OR REPLACE VIEW ${quoteMySql(name)} AS\n${definition}`;
    }
    if (objectType === 'PROCEDURE') {
      return `CREATE PROCEDURE ${quoteMySql(name)}\n${definition}`;
    }
    return `CREATE FUNCTION ${quoteMySql(name)}\n${definition}`;
  }

  if (dialect === 'SQL Server') {
    if (objectType === 'VIEW') {
      return `CREATE VIEW ${quoteSqlServer(name)} AS\n${definition}`;
    }
    if (objectType === 'PROCEDURE') {
      return `CREATE PROCEDURE ${quoteSqlServer(name)}\n${definition}`;
    }
    if (functionKind === 'TABLE_VALUED') {
      return `CREATE FUNCTION ${quoteSqlServer(name)}()\n${definition}`;
    }
    return `CREATE FUNCTION ${quoteSqlServer(name)}()\n${definition}`;
  }

  return definition;
};
