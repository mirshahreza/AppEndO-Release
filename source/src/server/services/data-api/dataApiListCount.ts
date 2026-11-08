import type { EdgeApiOperation } from '../../../shared/api/contracts/data-api';
import { readDataApiListIncludeCountEnabled } from './dataApiListPlatformSettings';

export type DataApiListCountMode = 'exact' | 'none';

export type ResolvedDataApiListCount = {
  includeCount: boolean;
  countMode: DataApiListCountMode | 'omitted';
};

export const parseIncludeCountQueryParam = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const text = String(value).trim().toLowerCase();
  if (!text) {
    return undefined;
  }
  if (text === 'true' || text === '1' || text === 'yes') {
    return true;
  }
  if (text === 'false' || text === '0' || text === 'no') {
    return false;
  }
  return undefined;
};

/**
 * Whether a Data API list operation should run Sequelize COUNT (findAndCountAll)
 * or only fetch the current page (findAll).
 */
export const resolveDataApiListIncludeCount = (
  query: Record<string, unknown>,
  operation: EdgeApiOperation,
): ResolvedDataApiListCount => {
  const fromQuery = parseIncludeCountQueryParam(query.includeCount);
  if (fromQuery !== undefined) {
    return {
      includeCount: fromQuery,
      countMode: fromQuery ? 'exact' : 'omitted',
    };
  }

  const operationMode = operation.query?.countMode;
  if (operationMode === 'none') {
    return { includeCount: false, countMode: 'none' };
  }
  if (operationMode === 'exact') {
    return { includeCount: true, countMode: 'exact' };
  }

  const platformIncludeCount = readDataApiListIncludeCountEnabled();
  if (platformIncludeCount !== undefined) {
    return {
      includeCount: platformIncludeCount,
      countMode: platformIncludeCount ? 'exact' : 'omitted',
    };
  }

  const defaultInclude = operation.query?.defaultIncludeCount;
  if (typeof defaultInclude === 'boolean') {
    return {
      includeCount: defaultInclude,
      countMode: defaultInclude ? 'exact' : 'omitted',
    };
  }

  return { includeCount: true, countMode: 'exact' };
};

export {
  readDataApiListCacheDefaultEnabled,
  readDataApiListCacheDefaultTtlMs,
} from './dataApiListPlatformSettings';
