/**
 * Shared query-param resolution for Designer list bindings.
 *
 * When a scoped `filter[field][in]=static:…` coexists with a toolbar
 * `filter[field][eq]=storePath`, apply `in` only while the toolbar value is
 * empty (All). Once the operator picks a specific value, send `eq` and omit
 * `in` so the two operators never fight.
 */

export const parseFilterQueryParamName = (
  paramName: string,
): { field: string; operator: string } | null => {
  const match = /^filter\[([^\]]+)\]\[([^\]]+)\]$/.exec(paramName);
  if (!match) {
    return null;
  }
  return { field: match[1]!, operator: match[2]! };
};

/** CMS designer snapshots once baked Base Info ids under root `102`; live seed uses `101`. */
const remapLegacyCmsBaseInfoFilterToken = (token: string): string => {
  const trimmed = token.trim();
  if (!trimmed.startsWith('102.')) {
    return trimmed;
  }
  return `101.${trimmed.slice('102.'.length)}`;
};

const remapLegacyCmsBaseInfoFilterText = (text: string): string => {
  if (!text.includes('102.')) {
    return text;
  }
  if (text.includes(',')) {
    return text.split(',').map(remapLegacyCmsBaseInfoFilterToken).join(',');
  }
  return remapLegacyCmsBaseInfoFilterToken(text);
};

/** COUNT only on page 1; later pages reuse hydrated total (see data-studio list COUNT). */
export const LIST_INCLUDE_COUNT_PAGE1_ONLY_BINDING = 'static:page1Only';

export const resolveListIncludeCountQueryValue = (
  readValue: (dataPath: string) => unknown,
): string => {
  const pageRaw = readValue('gridQuery.page');
  const page = Math.max(1, Number.parseInt(String(pageRaw ?? '1'), 10) || 1);
  return page <= 1 ? 'true' : 'false';
};

export const resolveBindingQueryParamText = (
  dataPath: string,
  readValue: (dataPath: string) => unknown,
): string | undefined => {
  if (dataPath === LIST_INCLUDE_COUNT_PAGE1_ONLY_BINDING) {
    return resolveListIncludeCountQueryValue(readValue);
  }
  const value = dataPath.startsWith('static:')
    ? dataPath.slice('static:'.length)
    : readValue(dataPath);
  if (value === undefined || value === null) {
    return undefined;
  }
  const text = remapLegacyCmsBaseInfoFilterText(String(value).trim());
  return text.length > 0 ? text : undefined;
};

/**
 * Builds URLSearchParams from binding query-param path maps.
 * Skips empty store values; defers scoped `in` filters when a non-empty `eq`
 * for the same field is present.
 */
export const buildBindingQuerySearchParams = (
  queryParams: Record<string, string>,
  readValue: (dataPath: string) => unknown,
): URLSearchParams => {
  const searchParams = new URLSearchParams();
  const eqFilterFields = new Set<string>();

  for (const [paramName, dataPath] of Object.entries(queryParams)) {
    const parsed = parseFilterQueryParamName(paramName);
    if (parsed?.operator !== 'eq' || dataPath.startsWith('static:')) {
      continue;
    }
    if (resolveBindingQueryParamText(dataPath, readValue)) {
      eqFilterFields.add(parsed.field);
    }
  }

  for (const [paramName, dataPath] of Object.entries(queryParams)) {
    const parsed = parseFilterQueryParamName(paramName);
    if (parsed?.operator === 'in' && eqFilterFields.has(parsed.field)) {
      continue;
    }
    const text = resolveBindingQueryParamText(dataPath, readValue);
    if (!text) {
      continue;
    }
    searchParams.set(paramName, text);
  }

  return searchParams;
};
