import { listManagedFunctionsFromStore } from '../../../core/functions/FunctionFileStore';
import { deleteManagedFunction } from '../../domain/functions/functionRepository';
import type { ApiRegistryRecord } from '../../domain/package-domain/types';
import { managedFunctionRouteRegistry } from '../managedFunctionRouteRegistry';

export function buildPackageApiSupersedeRouteKeys(apis: ApiRegistryRecord[]): Set<string> {
  const keys = new Set<string>();
  for (const api of apis) {
    keys.add(api.conflictKey);
    keys.add(`${api.method} ${api.httpPath}`);
  }
  return keys;
}

export function findManagedFunctionIdsSupersededByPackageApis(apis: ApiRegistryRecord[]): string[] {
  if (apis.length === 0) {
    return [];
  }

  const routeKeys = buildPackageApiSupersedeRouteKeys(apis);
  return listManagedFunctionsFromStore()
    .filter((fn) => routeKeys.has(`${fn.method} ${fn.path}`))
    .map((fn) => fn.id);
}

export async function supersedeManagedFunctionsForPackageApis(
  apis: ApiRegistryRecord[],
): Promise<{ removedIds: string[] }> {
  const removedIds = findManagedFunctionIdsSupersededByPackageApis(apis);

  for (const functionId of removedIds) {
    await deleteManagedFunction(functionId);
    managedFunctionRouteRegistry.invalidate(functionId);
  }

  return { removedIds };
}
