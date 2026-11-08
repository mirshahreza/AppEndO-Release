export type ServerFunctionScriptDocHints = {
  summary?: string;
  routeNote?: string;
  validationSchema?: Record<string, unknown> | null;
  outputFieldNames: string[];
  requiredBodyFields: string[];
  referencedQueryFields: string[];
  referencedParamFields: string[];
};

const HTTP_METHOD_LINE = /^\s*\/\/\s*(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s*]+)\s*$/im;
const NOTE_LINE = /^\s*\/\/\s*Note:\s*(.+)$/im;

const extractBalancedJsonObject = (source: string, startIndex: number): string | null => {
  if (source[startIndex] !== '{') {
    return null;
  }

  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === stringQuote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === '\'') {
      inString = true;
      stringQuote = char;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  return null;
};

const parseValidationSchemaFromScript = (code: string): Record<string, unknown> | null => {
  const marker = 'const VALIDATION_SCHEMA';
  const markerIndex = code.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const equalsIndex = code.indexOf('=', markerIndex);
  if (equalsIndex < 0) {
    return null;
  }

  const braceIndex = code.indexOf('{', equalsIndex);
  if (braceIndex < 0) {
    return null;
  }

  const jsonText = extractBalancedJsonObject(code, braceIndex);
  if (!jsonText) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};

const INSERT_BODY_EXCLUDED_COLUMNS = new Set([
  'created_by',
  'updated_by',
  'created_at',
  'updated_at',
]);

const parseInsertInputColumnsFromScript = (code: string): string[] => {
  const match = code.match(/INSERT\s+INTO\s+[\w.]+\s*\(([^)]+)\)/i);
  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split(',')
    .map((column) => column.trim())
    .filter((column) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column))
    .filter((column) => !INSERT_BODY_EXCLUDED_COLUMNS.has(column));
};

const buildValidationSchemaFromInsertColumns = (
  columnNames: string[],
): Record<string, unknown> | null => {
  if (columnNames.length === 0) {
    return null;
  }

  return {
    type: 'object',
    properties: Object.fromEntries(columnNames.map((name) => [name, { type: 'string' }])),
  };
};

const extractColumnsFromSelectSegment = (segment: string): string[] => {
  const normalized = segment
    .replace(/["']\s*\+\s*["']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized || normalized === '*') {
    return [];
  }

  return normalized
    .split(',')
    .map((column) => {
      const trimmed = column.trim();
      const aliasMatch = trimmed.match(/\s+AS\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/i);
      if (aliasMatch?.[1]) {
        return aliasMatch[1];
      }

      const withoutAlias = trimmed.replace(/\s+AS\s+[a-zA-Z_][a-zA-Z0-9_]*\s*$/i, '').trim();
      const dotIndex = withoutAlias.lastIndexOf('.');
      const rawName = dotIndex >= 0 ? withoutAlias.slice(dotIndex + 1) : withoutAlias;
      return rawName.replace(/^["'`]|["'`]$/g, '').trim();
    })
    .filter((name) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name));
};

const extractSqlLiteralsFromScript = (code: string): string[] => {
  const queryBlocks: string[] = [];

  for (const match of code.matchAll(/(?:db|edgeDb)\.query\s*\(\s*((?:\s*["'][^"']*["']\s*\+?\s*)+)\s*[,)]/gi)) {
    const block = match[1] ?? '';
    const literals = [...block.matchAll(/["']([^"']*)["']/g)].map((literal) => literal[1]?.trim() ?? '');
    if (literals.some((literal) => /\bSELECT\b/i.test(literal))) {
      queryBlocks.push(literals.join(' '));
    }
  }

  if (queryBlocks.length > 0) {
    return queryBlocks;
  }

  const literals = [...code.matchAll(/["']([^"']*)["']/g)]
    .map((match) => match[1]?.trim() ?? '')
    .filter((literal) => /\b(SELECT|FROM|RETURNING)\b/i.test(literal));

  return literals.length > 0 ? [literals.join(' ')] : [];
};

const parseSelectColumnsFromScript = (code: string): string[] => {
  const columns = new Set<string>();

  for (const match of code.matchAll(/`[\s\S]*?SELECT\s+([\s\S]*?)\s+FROM[\s\S]*?`/gi)) {
    extractColumnsFromSelectSegment(match[1] ?? '').forEach((column) => columns.add(column));
  }

  for (const sqlLiteral of extractSqlLiteralsFromScript(code)) {
    const selectMatch = sqlLiteral.match(/SELECT\s+([\s\S]*?)\s+FROM/i);
    if (selectMatch?.[1]) {
      extractColumnsFromSelectSegment(selectMatch[1]).forEach((column) => columns.add(column));
    }
  }

  for (const match of code.matchAll(/RETURNING\s+([^;)\n]+)/gi)) {
    extractColumnsFromSelectSegment(match[1] ?? '').forEach((column) => columns.add(column));
  }

  return [...columns];
};

export const parseResponseCollectionKeyFromScript = (code: string): string => {
  const match = code.match(/\bres(?:ponse)?\.json\(\s*\{[\s\S]*?\b(data|items|rows|results|records)\s*:/i);
  if (match?.[1]) {
    return match[1].toLowerCase();
  }

  if (/\bitems\s*:/.test(code) && /\bsuccess\s*:\s*true/.test(code)) {
    return 'items';
  }

  return 'data';
};

const BODY_ACCESS_PREFIX = '(?:payload|req\\.body|edgeReq\\.body|body|requestBody)';

const extractRequiredBodyFields = (code: string): string[] => {
  const fields = new Set<string>();

  const negationPattern = new RegExp(`!${BODY_ACCESS_PREFIX}\\.(\\w+)`, 'g');
  for (const match of code.matchAll(negationPattern)) {
    if (match[1]) {
      fields.add(match[1]);
    }
  }

  const destructuringPattern = new RegExp(
    `const\\s*\\{([^}]+)\\}\\s*=\\s*(?:${BODY_ACCESS_PREFIX}|req\\.body\\s*\\|\\||edgeReq\\.body\\s*\\|\\|)`,
    'g',
  );
  for (const match of code.matchAll(destructuringPattern)) {
    const names = match[1]
      .split(',')
      .map((part) => part.trim().split(':')[0]?.trim())
      .filter((name): name is string => Boolean(name) && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name));
    names.forEach((name) => fields.add(name));
  }

  const directAccessPattern = new RegExp(`${BODY_ACCESS_PREFIX}\\.(\\w+)`, 'g');
  for (const match of code.matchAll(directAccessPattern)) {
    if (match[1] && !['length', 'toString', 'valueOf'].includes(match[1])) {
      fields.add(match[1]);
    }
  }

  return [...fields];
};

const extractReferencedFields = (
  code: string,
  sourcePattern: string,
): string[] => {
  const fields = new Set<string>();
  const pattern = new RegExp(`${sourcePattern}\\.(\\w+)`, 'g');
  for (const match of code.matchAll(pattern)) {
    if (match[1]) {
      fields.add(match[1]);
    }
  }
  return [...fields];
};

const buildSummaryFromScript = (code: string, method: string, routePath: string): string | undefined => {
  const methodLine = code.match(HTTP_METHOD_LINE);
  if (methodLine) {
    return `${methodLine[1]} ${methodLine[2]}`;
  }

  return `${method.toUpperCase()} ${routePath}`;
};

export const parseServerFunctionScriptDoc = (
  code: string | null | undefined,
  method = 'GET',
  routePath = '/',
): ServerFunctionScriptDocHints | null => {
  if (!code || !code.trim()) {
    return null;
  }

  const routeNote = code.match(NOTE_LINE)?.[1]?.trim();
  let validationSchema = parseValidationSchemaFromScript(code);
  if (!validationSchema) {
    validationSchema = buildValidationSchemaFromInsertColumns(parseInsertInputColumnsFromScript(code));
  }
  const outputFieldNames = parseSelectColumnsFromScript(code);
  const requiredBodyFields = extractRequiredBodyFields(code);
  const referencedQueryFields = extractReferencedFields(code, '(?:req\\.query|edgeReq\\.query|query)');
  const referencedParamFields = extractReferencedFields(code, '(?:req\\.params|edgeReq\\.params|routeParams|params)');

  const hasSignal = Boolean(
    routeNote
    || validationSchema
    || outputFieldNames.length > 0
    || requiredBodyFields.length > 0
    || referencedQueryFields.length > 0
    || referencedParamFields.length > 0
    || HTTP_METHOD_LINE.test(code),
  );

  if (!hasSignal) {
    return null;
  }

  return {
    routeNote,
    validationSchema,
    outputFieldNames,
    requiredBodyFields,
    referencedQueryFields,
    referencedParamFields,
    summary: buildSummaryFromScript(code, method, routePath),
  };
};

export const buildScriptDocFingerprintSource = (input: {
  code?: string | null;
  metadata_json?: string | null;
  test_payload?: string | null;
  method: string;
  path: string;
  updated_at?: string | null;
}): string => JSON.stringify({
  code: input.code ?? '',
  metadata_json: input.metadata_json ?? '',
  test_payload: input.test_payload ?? '',
  method: input.method,
  path: input.path,
  updated_at: input.updated_at ?? '',
});
