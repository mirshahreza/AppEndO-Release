import type {
  BuilderContext,
  BuilderRegistryEntry,
  BuilderType,
  BuilderValidationResult,
  CreateBuilderContextInput,
  ResolveBuilderInput,
} from '../../api/contracts/appendoo/builderProtocol.types';
import type { ChangeNode } from '../../api/contracts/appendoo/changeGraph.types';
import {
  BUILDER_PROTOCOL_VERSION,
  DEFAULT_BUILDER_REGISTRY,
} from '../../api/contracts/appendoo/builderProtocol.types';
import { isActiveRootMutation } from './engineeringWorkspaceScaffold';

export const resolveBuilderForOperation = (
  input: ResolveBuilderInput,
  registry: BuilderRegistryEntry[] = DEFAULT_BUILDER_REGISTRY,
): BuilderRegistryEntry | null => {
  const enabledCapabilities = new Set(input.enabledCapabilities ?? []);

  for (const entry of registry) {
    if (!entry.supportedOperations.includes(input.operationType)) continue;
    if (!entry.enabled) continue;
    if (entry.requiresCapability && !enabledCapabilities.has(entry.requiresCapability)) continue;
    return entry;
  }

  return null;
};

/** AE-8.1 scaffold — deterministic BuilderContext from workspace revision + change node. */
export const createBuilderContextScaffold = (input: CreateBuilderContextInput): BuilderContext => ({
  workspaceId: input.workspaceId,
  revisionId: input.revisionId,
  operationId: input.changeNode.operationId,
  changeSetId: input.changeSetId,
  correlationId: input.correlationId,
  changeNode: input.changeNode,
  applicableStandards: input.applicableStandards ?? [],
  patternVersions: input.patternVersions ?? [],
  validatedCapabilities: input.validatedCapabilities ?? [],
});

export const validateBuilderMutationPaths = (
  paths: string[],
): BuilderValidationResult => {
  const errors = paths
    .filter((path) => isActiveRootMutation(path))
    .map((path) => `Active-root mutation rejected: ${path}`);

  return {
    ok: errors.length === 0,
    phase: 'validate',
    errors,
    warnings: [],
  };
};

/** AE-8.3 — preserve ASP provider bindings on ChangeNode execution. */
export const validateChangeNodeProviderBinding = (
  node: ChangeNode,
): BuilderValidationResult => {
  const errors: string[] = [];

  if (node.requiredCapabilityIds.length === 0) {
    errors.push(`ChangeNode ${node.nodeId} is missing requiredCapabilityIds.`);
  }

  if (node.providerBinding) {
    if (!node.requiredCapabilityIds.includes(node.providerBinding.capabilityId)) {
      errors.push(
        `Provider binding capability ${node.providerBinding.capabilityId} `
        + `not listed in requiredCapabilityIds for ${node.nodeId}.`,
      );
    }
    if (
      node.capabilitySnapshotVersion
      && node.providerBinding.capabilitySnapshotVersion !== node.capabilitySnapshotVersion
    ) {
      errors.push(`Provider binding snapshot drift on ${node.nodeId}.`);
    }
  }

  return {
    ok: errors.length === 0,
    phase: 'validate',
    errors,
    warnings: [],
  };
};

export const validateBuilderContext = (
  context: BuilderContext,
  paths: string[],
): BuilderValidationResult => {
  const pathValidation = validateBuilderMutationPaths(paths);
  if (!pathValidation.ok) {
    return pathValidation;
  }

  const bindingValidation = validateChangeNodeProviderBinding(context.changeNode);
  if (!bindingValidation.ok) {
    return bindingValidation;
  }

  const builder = resolveBuilderForOperation({
    operationType: context.changeNode.operationType,
    enabledCapabilities: context.validatedCapabilities.map((cap) => cap.capabilityId),
  });

  if (!builder) {
    return {
      ok: false,
      phase: 'validate',
      errors: [`No enabled builder for operation ${context.changeNode.operationType}`],
      warnings: [],
    };
  }

  return {
    ok: true,
    phase: 'validate',
    errors: [],
    warnings: [],
  };
};

export const summarizeBuilderResolution = (
  builderType: BuilderType | null,
  operationType: ResolveBuilderInput['operationType'],
): {
  builderType: BuilderType | null;
  operationType: ResolveBuilderInput['operationType'];
  protocolVersion: string;
} => ({
  builderType,
  operationType,
  protocolVersion: BUILDER_PROTOCOL_VERSION,
});

export type { BuilderRegistryEntry };
