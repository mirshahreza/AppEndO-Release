import { buildManagedFunctionId, sanitizeFunctionSegment } from '../functions/functionNaming';
import type { ChangeSet } from '../../shared/api/contracts/ai/agentTypes';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

export type ServerFunctionHttpMethod = typeof HTTP_METHODS[number];

export const buildManagedServerFunctionPath = (folder: string, name: string): string => {
  const folderSegment = sanitizeFunctionSegment(folder) || 'general';
  const nameSegment = sanitizeFunctionSegment(name) || 'action-name';
  return `/api/${folderSegment}/${nameSegment}`;
};

const normalizeHttpMethod = (value?: string): ServerFunctionHttpMethod | null => {
  const upper = value?.trim().toUpperCase();
  return HTTP_METHODS.find((method) => method === upper) ?? null;
};

const defaultTestPayloadForMethod = (_method: ServerFunctionHttpMethod): string => '{}';

export type ResolvedServerFunctionDraftMetadata = {
  functionId: string;
  name: string;
  folder: string;
  method: ServerFunctionHttpMethod;
  path: string;
  testPayload: string;
};

export const resolveServerFunctionDraftMetadata = (input: {
  name: string;
  folder?: string;
  method?: string;
  path?: string;
  testPayload?: string;
  functionId?: string;
}): ResolvedServerFunctionDraftMetadata => {
  const trimmedExistingId = input.functionId?.trim();
  const folder = sanitizeFunctionSegment(input.folder?.trim() || 'general') || 'general';
  const name = sanitizeFunctionSegment(input.name) || 'unnamed';
  const functionId = trimmedExistingId?.includes('.')
    ? trimmedExistingId
    : buildManagedFunctionId(folder, name);
  const method = normalizeHttpMethod(input.method) ?? 'GET';
  const path = input.path?.trim() || buildManagedServerFunctionPath(folder, name);
  const testPayload = input.testPayload?.trim() || defaultTestPayloadForMethod(method);

  return {
    functionId,
    name,
    folder,
    method,
    path,
    testPayload,
  };
};

export const resolveManagedFunctionIdFromChangeSet = (
  changeSet: Extract<ChangeSet, { kind: 'function_source_patch' }>,
): string => {
  const patch = changeSet.patch && typeof changeSet.patch === 'object' && !Array.isArray(changeSet.patch)
    ? changeSet.patch as Record<string, unknown>
    : {};
  const name = typeof patch.name === 'string' ? patch.name : changeSet.functionId;
  const folder = typeof patch.folder === 'string' ? patch.folder : 'general';
  if (changeSet.functionId.includes('.')) {
    return changeSet.functionId;
  }
  return buildManagedFunctionId(folder, name);
};
