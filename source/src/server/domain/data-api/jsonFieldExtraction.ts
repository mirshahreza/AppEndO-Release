export type JsonExtractionDialect =
  | 'postgres'
  | 'postgresql'
  | 'mssql'
  | 'mysql'
  | 'sqlite'
  | 'oracle';

export type JsonFieldExtraction = {
  outputField: string;
  sourceColumn: string;
  jsonPath: string;
};

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const assertSafeSqlIdentifier = (value: string, label: string): string => {
  const trimmed = value.trim();
  if (!IDENTIFIER.test(trimmed)) {
    throw new Error(`${label} is not a safe SQL identifier.`);
  }
  return trimmed;
};

export const quoteSqlIdentifier = (value: string, dialect: string): string => {
  const ident = assertSafeSqlIdentifier(value, 'Identifier');
  const normalized = dialect.trim().toLowerCase();
  if (normalized === 'mysql') {
    return `\`${ident}\``;
  }
  if (normalized === 'mssql') {
    return `[${ident}]`;
  }
  return `"${ident}"`;
};

/** Accept `$.a.b`, `a.b`, or `{a,b}` and return path segments. */
export const parseJsonPathSegments = (jsonPath: string): string[] => {
  const trimmed = jsonPath.trim();
  if (!trimmed) {
    throw new Error('JSON path is required.');
  }
  const withoutRoot = trimmed.replace(/^\$\.?/, '').replace(/^\{/, '').replace(/\}$/, '');
  const segments = withoutRoot
    .split(/[.[\]]+/)
    .map((part) => part.replace(/^['"]|['"]$/g, '').trim())
    .filter(Boolean);
  if (segments.length === 0) {
    throw new Error('JSON path must name at least one field.');
  }
  for (const segment of segments) {
    if (!/^[A-Za-z0-9_$-]+$/.test(segment)) {
      throw new Error('JSON path contains an unsupported segment.');
    }
  }
  return segments;
};

export const compileJsonExtractionSql = (
  extraction: JsonFieldExtraction,
  dialect: string | null | undefined,
): string => {
  const column = quoteSqlIdentifier(extraction.sourceColumn, dialect ?? 'postgres');
  const segments = parseJsonPathSegments(extraction.jsonPath);
  const normalized = (dialect ?? 'postgres').trim().toLowerCase();
  const dotted = `$.${segments.join('.')}`;

  if (normalized === 'postgres' || normalized === 'postgresql') {
    const pgPath = `{${segments.join(',')}}`;
    return `(${column} #>> '${pgPath}')`;
  }
  if (normalized === 'mssql') {
    return `JSON_VALUE(${column}, '${dotted}')`;
  }
  if (normalized === 'oracle') {
    return `JSON_VALUE(${column}, '${dotted}')`;
  }
  if (normalized === 'mysql') {
    return `JSON_UNQUOTE(JSON_EXTRACT(${column}, '${dotted}'))`;
  }
  return `json_extract(${column}, '${dotted}')`;
};
