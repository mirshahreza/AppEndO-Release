import type {
  EuaExtractedFieldValue,
  EuaFieldAssistExtractRequest,
  EuaFieldMapEntry,
} from '../../api/contracts/ai/euaFieldAssist';

export const EUA_STRUCTURED_EXTRACT_SYSTEM_PROMPT =
  'You extract structured form field values from unstructured text. Return ONLY valid JSON in this shape: {"fields":[{"name":"fieldName","value":"extracted value"}]}. The name property MUST be the exact schema name (not the label). Omit fields you cannot infer. Do not add markdown fences or explanation.';

export function buildStructuredExtractUserPrompt(request: EuaFieldAssistExtractRequest): string {
  const lines: string[] = [];

  if (request.sectionTitle?.trim()) {
    lines.push(`Section: ${request.sectionTitle.trim()}`);
  }
  if (request.sectionDescription?.trim()) {
    lines.push(`Section description: ${request.sectionDescription.trim()}`);
  }

  lines.push('Field schema (use name exactly in JSON output):');
  request.fields.forEach((field) => {
    const hints = [
      `name="${field.name}"`,
      `label="${field.label}"`,
      `type=${field.type}`,
      field.required ? 'required=true' : null,
      field.validationHint ? `hint=${field.validationHint}` : null,
      field.currentValue?.trim() ? `current=${field.currentValue.trim()}` : null,
    ].filter(Boolean);
    lines.push(`- ${hints.join('; ')}`);
  });

  lines.push('');
  lines.push('Source text:');
  lines.push(request.text.trim());

  return lines.join('\n');
}

type ParsedExtractPayload = {
  fields?: unknown;
  [key: string]: unknown;
};

function readFieldValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function resolveSchemaFieldName(candidate: string, schema: EuaFieldMapEntry[]): string | null {
  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }

  const exact = schema.find((field) => field.name === trimmed);
  if (exact) {
    return exact.name;
  }

  const normalizedCandidate = normalizeLookupKey(trimmed);
  for (const field of schema) {
    if (normalizeLookupKey(field.name) === normalizedCandidate) {
      return field.name;
    }
    if (normalizeLookupKey(field.label) === normalizedCandidate) {
      return field.name;
    }
  }

  return null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addExtractedValue(
  results: Map<string, string>,
  schema: EuaFieldMapEntry[],
  candidateName: string,
  value: string,
): void {
  const resolvedName = resolveSchemaFieldName(candidateName, schema);
  const trimmedValue = value.trim();
  if (!resolvedName || !trimmedValue) {
    return;
  }
  results.set(resolvedName, trimmedValue);
}

function parseJsonPayload(raw: string, schema: EuaFieldMapEntry[]): EuaExtractedFieldValue[] {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const results = new Map<string, string>();

  let payload: ParsedExtractPayload | unknown[];
  try {
    payload = JSON.parse(trimmed) as ParsedExtractPayload | unknown[];
  } catch {
    throw new Error('AI returned invalid JSON for structured extract.');
  }

  if (Array.isArray(payload)) {
    payload.forEach((entry) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      const record = entry as { name?: unknown; label?: unknown; value?: unknown };
      const candidate = typeof record.name === 'string'
        ? record.name
        : typeof record.label === 'string'
          ? record.label
          : '';
      addExtractedValue(results, schema, candidate, readFieldValue(record.value));
    });
  } else if (payload && typeof payload === 'object') {
    const objectPayload = payload as ParsedExtractPayload;
    const fieldEntries = objectPayload.fields;

    if (Array.isArray(fieldEntries)) {
      fieldEntries.forEach((entry) => {
        if (!entry || typeof entry !== 'object') {
          return;
        }
        const record = entry as { name?: unknown; label?: unknown; value?: unknown };
        const candidate = typeof record.name === 'string'
          ? record.name
          : typeof record.label === 'string'
            ? record.label
            : '';
        addExtractedValue(results, schema, candidate, readFieldValue(record.value));
      });
    } else if (fieldEntries && typeof fieldEntries === 'object' && !Array.isArray(fieldEntries)) {
      Object.entries(fieldEntries as Record<string, unknown>).forEach(([key, value]) => {
        addExtractedValue(results, schema, key, readFieldValue(value));
      });
    }

    Object.entries(objectPayload).forEach(([key, value]) => {
      if (key === 'fields') {
        return;
      }
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        addExtractedValue(results, schema, key, readFieldValue(value));
      }
    });
  }

  return schema
    .map((field) => {
      const value = results.get(field.name);
      return value ? { name: field.name, value } : null;
    })
    .filter((entry): entry is EuaExtractedFieldValue => entry !== null);
}

type LabelMarker = {
  name: string;
  labelStart: number;
  valueStart: number;
};

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

function findLabelMarkers(text: string, schema: EuaFieldMapEntry[]): LabelMarker[] {
  const markers: LabelMarker[] = [];

  for (const field of schema) {
    const candidates = [field.label, field.name];
    for (const candidate of candidates) {
      if (!candidate.trim()) {
        continue;
      }
      const pattern = new RegExp(
        `(?:^|[\\r\\n])\\s*${escapeRegex(candidate)}\\s*[:：]\\s*`,
        'i',
      );
      const match = pattern.exec(text);
      if (match) {
        markers.push({
          name: field.name,
          labelStart: match.index,
          valueStart: match.index + match[0].length,
        });
        break;
      }
    }
  }

  return markers.sort((left, right) => left.labelStart - right.labelStart);
}

function parseLabeledSourceTextByLine(
  text: string,
  schema: EuaFieldMapEntry[],
  results: Map<string, string>,
): void {
  const lines = text.split(/\r?\n/);

  for (const field of schema) {
    const candidates = [field.label, field.name];
    for (const line of lines) {
      for (const candidate of candidates) {
        const pattern = new RegExp(`^\\s*${escapeRegex(candidate)}\\s*[:：]\\s*(.+)$`, 'i');
        const match = line.match(pattern);
        if (match?.[1]) {
          addExtractedValue(results, schema, field.name, match[1]);
          break;
        }
      }
      if (results.has(field.name)) {
        break;
      }
    }
  }
}

export function parseLabeledSourceText(
  text: string,
  schema: EuaFieldMapEntry[],
): EuaExtractedFieldValue[] {
  const normalizedText = stripBom(text);
  const results = new Map<string, string>();
  const markers = findLabelMarkers(normalizedText, schema);

  if (markers.length > 0) {
    for (let index = 0; index < markers.length; index += 1) {
      const valueStart = markers[index].valueStart;
      const valueEnd = index + 1 < markers.length
        ? markers[index + 1].labelStart
        : normalizedText.length;
      const value = normalizedText.slice(valueStart, valueEnd).trim();
      if (value) {
        results.set(markers[index].name, value);
      }
    }
  } else {
    parseLabeledSourceTextByLine(normalizedText, schema, results);
  }

  return schema
    .map((field) => {
      const value = results.get(field.name);
      return value ? { name: field.name, value } : null;
    })
    .filter((entry): entry is EuaExtractedFieldValue => entry !== null);
}

export function extractFieldValuesLocally(
  sourceText: string,
  schema: EuaFieldMapEntry[],
  rawAiResponse = '',
): EuaExtractedFieldValue[] {
  return extractStructuredFieldValues(rawAiResponse, sourceText, schema);
}

export function parseStructuredExtractResponse(
  raw: string,
  schema: EuaFieldMapEntry[],
): EuaExtractedFieldValue[] {
  return parseJsonPayload(raw, schema);
}

export function extractStructuredFieldValues(
  rawAiResponse: string,
  sourceText: string,
  schema: EuaFieldMapEntry[],
): EuaExtractedFieldValue[] {
  let extracted: EuaExtractedFieldValue[] = [];
  try {
    extracted = parseJsonPayload(rawAiResponse, schema);
  } catch {
    extracted = [];
  }

  if (extracted.length === 0) {
    extracted = parseLabeledSourceText(sourceText, schema);
  }

  return extracted;
}
