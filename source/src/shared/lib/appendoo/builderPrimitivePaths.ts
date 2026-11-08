import type { ChangeNode, ChangeOperationType } from '../../api/contracts/appendoo/changeGraph.types';
import type { BuilderType } from '../../api/contracts/appendoo/builderProtocol.types';
import { DEFAULT_BUILDER_REGISTRY } from '../../api/contracts/appendoo/builderProtocol.types';

export const workspaceRoot = (changeSetId: string): string => `appendoo/ws/${changeSetId}`;

export const sanitizeBuilderSegment = (value: string): string => {
  const sanitized = value
    .replace(/[:/\\]/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return sanitized.length > 0 ? sanitized : 'artifact';
};

/** Map operation type to responsible Builder (Phase 16). */
export const resolveBuilderTypeForOperation = (
  operationType: ChangeOperationType,
): BuilderType | null => {
  const entry = DEFAULT_BUILDER_REGISTRY.find((item) => item.supportedOperations.includes(operationType));
  return entry?.enabled ? entry.builderType : null;
};

/**
 * AE-8.4 — workspace-scoped paths mirroring AppEndO runtime primitives.
 * All paths stay under appendoo/ws/{changeSetId}/ — never active application roots.
 */
export const resolveBuilderPrimitivePaths = (node: ChangeNode): string[] => {
  const root = workspaceRoot(node.changeSetId);
  const target = sanitizeBuilderSegment(node.targetRef.ref ?? node.targetRef.targetId);

  switch (node.operationType) {
    case 'CREATE_SERVER_FUNCTION':
    case 'MODIFY_SERVER_FUNCTION':
    case 'REMOVE_SERVER_FUNCTION':
      return [
        `${root}/workspace/server-functions/custom/${target}.ts`,
        `${root}/workspace/server-functions/custom/${target}.metadata.json`,
      ];
    case 'CREATE_PAGE':
    case 'MODIFY_PAGE':
    case 'REMOVE_PAGE':
      return [
        `${root}/workspace/designer/drafts/${target}/draft.json`,
        `${root}/workspace/designer/drafts/${target}/page.tsx`,
      ];
    case 'CREATE_COMPONENT':
    case 'MODIFY_COMPONENT':
    case 'REMOVE_COMPONENT':
      return [
        `${root}/workspace/designer/drafts/${target}/draft.json`,
        `${root}/workspace/designer/drafts/${target}/component.tsx`,
      ];
    case 'CREATE_ROUTE':
    case 'MODIFY_ROUTE':
    case 'REMOVE_ROUTE':
      return [`${root}/workspace/platform-registry/routes/${target}.json`];
    case 'CREATE_PERMISSION':
    case 'MODIFY_PERMISSION':
    case 'REMOVE_PERMISSION':
      return [`${root}/workspace/platform-registry/permissions/${target}.json`];
    case 'CREATE_ENTITY':
    case 'MODIFY_ENTITY':
    case 'REMOVE_ENTITY':
    case 'CREATE_RELATION':
    case 'MODIFY_RELATION':
    case 'REMOVE_RELATION':
      return [`${root}/runtime/data-sources/schema/${target}.json`];
    case 'UPDATE_PACKAGE_MANIFEST':
      return [`${root}/runtime/packages/manifest.json`];
    case 'RUN_MIGRATION':
      return [`${root}/runtime/migrations/${target}.sql`];
    case 'UPDATE_CONFIGURATION':
      return [`${root}/runtime/config/${target}.json`];
    case 'CREATE_WORKFLOW':
    case 'MODIFY_WORKFLOW':
    case 'REMOVE_WORKFLOW':
      return [`${root}/runtime/workflows/${target}.json`];
    default:
      return [`${root}/artifacts/${target}.artifact.ts`];
  }
};

/** Primary mutation path for a change node (backward-compatible entry point). */
export const resolveWorkspaceMutationPath = (node: ChangeNode): string => (
  resolveBuilderPrimitivePaths(node)[0] ?? `${workspaceRoot(node.changeSetId)}/artifacts/unknown.artifact.ts`
);

export const resolveBuilderPrimitiveScope = (changeSetId: string): string[] => (
  [`${workspaceRoot(changeSetId)}/**`]
);

export const describeBuilderPrimitive = (node: ChangeNode): string => {
  const builderType = resolveBuilderTypeForOperation(node.operationType);
  return builderType
    ? `${builderType}:${node.operationType}`
    : node.operationType;
};
