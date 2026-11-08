import {
  DATASHEET_WINDOW_DEFAULT_PAGE_SIZE,
  DATASHEET_WINDOW_MAX_PAGE_SIZE,
  assertDatasheetLimit,
} from './datasheetWindow';

const MAX_SQL_LENGTH = 8000;

const FORBIDDEN_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|MERGE|EXEC|EXECUTE|CREATE|GRANT|REVOKE|INTO|UNION|WAITFOR)\b/i;

const FORBIDDEN_SELECT =
  /\b(JOIN|UNION|INTO|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|MERGE|EXEC|EXECUTE|WITH)\b/i;

export const quoteDatasheetIdent = (sourceType: string, name: string): string => {
  const dialect = sourceType.trim();
  if (dialect === 'PostgreSQL' || dialect === 'Oracle') {
    return `"${name.replace(/"/g, '""')}"`;
  }
  if (dialect === 'MySQL' || dialect === 'SQLite') {
    return `\`${name.replace(/`/g, '``')}\``;
  }
  return `[${name.replace(/]/g, ']]')}]`;
};

export function qualifyDatasheetTableSql(
  sourceType: string,
  schema: string | null | undefined,
  objectName: string,
): string {
  const table = schema
    ? `${quoteDatasheetIdent(sourceType, schema)}.${quoteDatasheetIdent(sourceType, objectName)}`
    : quoteDatasheetIdent(sourceType, objectName);
  return table;
}

export type BuildDatasheetSelectSqlInput = {
  sourceType: string;
  schema?: string | null;
  objectName: string;
  columnNames: string[];
  limit?: number;
  whereSql?: string | null;
};

/** Full editable SELECT sentence: named columns + TOP/LIMIT, never `*`. */
export function buildDatasheetSelectSql(input: BuildDatasheetSelectSqlInput): string {
  const limit = assertDatasheetLimit(input.limit ?? DATASHEET_WINDOW_DEFAULT_PAGE_SIZE);
  const cols = input.columnNames
    .map((name) => quoteDatasheetIdent(input.sourceType, name))
    .join(', ');
  const table = qualifyDatasheetTableSql(input.sourceType, input.schema, input.objectName);
  const where = input.whereSql?.trim() ? ` WHERE ${input.whereSql.trim()}` : '';
  const dialect = input.sourceType.trim();
  if (dialect === 'SQL Server') {
    return `SELECT TOP ${limit} ${cols} FROM ${table}${where}`;
  }
  if (dialect === 'Oracle') {
    return `SELECT ${cols} FROM ${table}${where} FETCH FIRST ${limit} ROWS ONLY`;
  }
  return `SELECT ${cols} FROM ${table}${where} LIMIT ${limit}`;
}

/** Replace quoted / bracketed regions so keyword checks ignore string and identifier literals. */
export function stripQuotedSqlRegions(sql: string): string {
  let out = '';
  let index = 0;
  while (index < sql.length) {
    const char = sql[index];
    if (char === "'" || char === '"' || char === '`') {
      const quote = char;
      out += ' ';
      index += 1;
      while (index < sql.length) {
        if (sql[index] === quote) {
          if (sql[index + 1] === quote) {
            out += '  ';
            index += 2;
            continue;
          }
          out += ' ';
          index += 1;
          break;
        }
        out += ' ';
        index += 1;
      }
      continue;
    }
    if (char === '[') {
      out += ' ';
      index += 1;
      while (index < sql.length && sql[index] !== ']') {
        out += ' ';
        index += 1;
      }
      if (index < sql.length) {
        out += ' ';
        index += 1;
      }
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

const splitOnExposed = (text: string, separator: string): string[] => {
  const exposed = stripQuotedSqlRegions(text);
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (exposed[index] === separator) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
};

const unquoteIdent = (token: string): string => {
  const trimmed = token.trim();
  if (
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
    || (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith('`') && trimmed.endsWith('`'))
  ) {
    const inner = trimmed.slice(1, -1);
    if (trimmed.startsWith('[')) {
      return inner.replace(/\]\]/g, ']');
    }
    if (trimmed.startsWith('"')) {
      return inner.replace(/""/g, '"');
    }
    return inner.replace(/``/g, '`');
  }
  return trimmed;
};

const lastIdent = (token: string): string => {
  const parts = splitOnExposed(token, '.').map((part) => part.trim()).filter(Boolean);
  const last = parts[parts.length - 1] ?? token;
  return unquoteIdent(last);
};

const selectListColumnName = (token: string): string => {
  const exposed = stripQuotedSqlRegions(token);
  const asMatch = exposed.match(/\sas\s/i);
  const core = asMatch && asMatch.index != null
    ? token.slice(0, asMatch.index).trim()
    : token.trim();
  return lastIdent(core);
};

const stripTrailingQueryClauses = (text: string): string => (
  text.replace(/\b(order\s+by|group\s+by|having|limit|offset|fetch)\b[\s\S]*$/i, '').trim()
);

const assertNoInjection = (text: string, label: string): void => {
  const exposed = stripQuotedSqlRegions(text);
  if (exposed.includes(';')) {
    throw new Error('Multiple SQL statements are not allowed.');
  }
  if (exposed.includes('--') || exposed.includes('/*')) {
    throw new Error('SQL comments are not allowed in the datasheet sentence.');
  }
  if (FORBIDDEN_KEYWORDS.test(exposed) && label === 'where') {
    throw new Error('Only a filter expression is allowed — not a changing statement.');
  }
};

/**
 * Accept a WHERE fragment, optional leading WHERE, or `SELECT … FROM … WHERE …`.
 * Empty input means unfiltered. Throws on multi-statement / DML / comments.
 */
export function parseDatasheetWhereSql(raw: unknown): string | null {
  if (raw == null) {
    return null;
  }
  let text = String(raw).trim();
  if (!text) {
    return null;
  }
  if (text.length > MAX_SQL_LENGTH) {
    throw new Error(`SQL sentence cannot exceed ${MAX_SQL_LENGTH} characters.`);
  }

  if (/^select\b/i.test(text)) {
    const exposedSelect = stripQuotedSqlRegions(text);
    if (FORBIDDEN_SELECT.test(exposedSelect)) {
      throw new Error('Only a SELECT of this table (optional WHERE) is allowed.');
    }
    const whereMatch = text.match(/\bwhere\b([\s\S]*)$/i);
    if (!whereMatch) {
      return null;
    }
    text = stripTrailingQueryClauses(whereMatch[1].trim());
  } else {
    text = text.replace(/^where\b\s*/i, '').trim();
  }

  if (!text) {
    return null;
  }

  assertNoInjection(text, 'where');
  return text;
}

export type ParsedDatasheetSelectSql = {
  limit: number;
  whereSql: string | null;
  /** Null means every visible column (`*` or omitted list). */
  columnNames: string[] | null;
};

const extractLimit = (sql: string): number => {
  const top = sql.match(/^select\s+top\s*\(?\s*(\d+)\s*\)?/i);
  if (top) {
    return assertDatasheetLimit(top[1]);
  }
  const exposed = stripQuotedSqlRegions(sql);
  const fetch = exposed.match(/\bfetch\s+(?:first|next)\s+(\d+)/i);
  if (fetch) {
    return assertDatasheetLimit(fetch[1]);
  }
  const limit = exposed.match(/\blimit\s+(\d+)/i);
  if (limit) {
    return assertDatasheetLimit(limit[1]);
  }
  return DATASHEET_WINDOW_DEFAULT_PAGE_SIZE;
};

const extractSelectList = (sql: string): string[] | null => {
  let rest = sql.replace(/^select\s+/i, '');
  rest = rest.replace(/^top\s*\(?\s*\d+\s*\)?\s+/i, '');
  rest = rest.replace(/^distinct\s+/i, '');
  const fromMatch = rest.match(/^([\s\S]+?)\s+from\b/i);
  if (!fromMatch) {
    throw new Error('SELECT must include FROM.');
  }
  const list = fromMatch[1].trim();
  if (!list || list === '*') {
    return null;
  }
  return splitOnExposed(list, ',')
    .map((token) => selectListColumnName(token))
    .filter(Boolean);
};

/** Parse the datasheet SQL sentence: columns, TOP/LIMIT, and WHERE. */
export function parseDatasheetSelectSql(raw: unknown): ParsedDatasheetSelectSql {
  const text = String(raw ?? '').trim();
  if (!text) {
    return {
      limit: DATASHEET_WINDOW_DEFAULT_PAGE_SIZE,
      whereSql: null,
      columnNames: null,
    };
  }
  if (text.length > MAX_SQL_LENGTH) {
    throw new Error(`SQL sentence cannot exceed ${MAX_SQL_LENGTH} characters.`);
  }

  if (!/^select\b/i.test(text)) {
    return {
      limit: DATASHEET_WINDOW_DEFAULT_PAGE_SIZE,
      whereSql: parseDatasheetWhereSql(text),
      columnNames: null,
    };
  }

  const exposed = stripQuotedSqlRegions(text);
  if (FORBIDDEN_SELECT.test(exposed)) {
    throw new Error('Only a SELECT of this table (optional WHERE) is allowed.');
  }
  if (exposed.includes(';')) {
    throw new Error('Multiple SQL statements are not allowed.');
  }
  if (exposed.includes('--') || exposed.includes('/*')) {
    throw new Error('SQL comments are not allowed in the datasheet sentence.');
  }

  const limit = extractLimit(text);
  if (limit > DATASHEET_WINDOW_MAX_PAGE_SIZE) {
    throw new Error(`Cannot load more than ${DATASHEET_WINDOW_MAX_PAGE_SIZE} rows.`);
  }

  return {
    limit,
    whereSql: parseDatasheetWhereSql(text),
    columnNames: extractSelectList(text),
  };
}
