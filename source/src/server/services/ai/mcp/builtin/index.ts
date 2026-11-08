import {
  DEFAULT_ENABLED_CAPABILITY_PACK_IDS,
  type AiCapabilityPackId,
} from '../../../../../shared/api/contracts/ai/capabilityPacks';
import type { ToolRegistry } from '../../../../../core/ai/tools/ToolRegistry';
import { registerCodebasePackTools } from './codebasePack';
import { registerContextPackTools } from './contextPack';
import { registerDataPackTools } from './dataPack';
import { registerDesignerPackTools } from './designerPack';
import { registerFilesPackTools } from './filesPack';
import { registerGitPackTools } from './gitPack';
import { registerHttpPackTools } from './httpPack';
import { registerServerFunctionPackTools } from './serverFunctionPack';
import { registerJobsPackTools } from './jobsPack';
import { registerPackagesPackTools } from './packagesPack';
import { registerMemoryPackTools } from './memoryPack';
import { registerCachePackTools } from './cachePack';
import { registerOpenApiPackTools } from './openapiPack';
import { registerStandardsPackTools } from './standardsPack';
import { registerWebPackTools } from './webPack';
import { registerWorkflowActionsPackTools } from './workflowActionsPack';
import type { BuiltinCapabilityPackRegistrar } from './types';

/** In-process built-in pack registrars — one entry per implemented pack. */
export const BUILTIN_CAPABILITY_PACK_REGISTRARS: Readonly<
  Partial<Record<AiCapabilityPackId, BuiltinCapabilityPackRegistrar>>
> = {
  'appendo-files': registerFilesPackTools,
  'appendo-codebase': registerCodebasePackTools,
  'appendo-git': registerGitPackTools,
  'appendo-web': registerWebPackTools,
  'appendo-http': registerHttpPackTools,
  'appendo-standards': registerStandardsPackTools,
  'appendo-context': registerContextPackTools,
  'appendo-designer': registerDesignerPackTools,
  'appendo-data': registerDataPackTools,
  'appendo-openapi': registerOpenApiPackTools,
  'appendo-jobs': registerJobsPackTools,
  'appendo-server-functions': registerServerFunctionPackTools,
  'appendo-packages': registerPackagesPackTools,
  'appendo-memory': registerMemoryPackTools,
  'appendo-cache': registerCachePackTools,
  'appendo-workflow': registerWorkflowActionsPackTools,
};

export const resolveEnabledCapabilityPackIds = (
  enabledPackIds?: readonly AiCapabilityPackId[],
): AiCapabilityPackId[] => {
  if (enabledPackIds && enabledPackIds.length > 0) {
    return [...enabledPackIds];
  }
  return [...DEFAULT_ENABLED_CAPABILITY_PACK_IDS];
};

export const registerBuiltinCapabilityPacks = (
  registry: Pick<ToolRegistry, 'register'>,
  enabledPackIds?: readonly AiCapabilityPackId[],
): void => {
  const packIds = resolveEnabledCapabilityPackIds(enabledPackIds);
  const seen = new Set<AiCapabilityPackId>();

  packIds.forEach((packId) => {
    if (seen.has(packId)) return;
    seen.add(packId);

    const registrar = BUILTIN_CAPABILITY_PACK_REGISTRARS[packId];
    if (registrar) {
      registrar(registry);
    }
  });
};
