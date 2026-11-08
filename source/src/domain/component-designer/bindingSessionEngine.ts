import type { DesignerBindingDefinition, DesignerNode, DesignerSessionField } from './types';
import type { ResolvedStoreReadBinding } from './bindingStoreEngine';

const propertyBindingKeyForProp = (targetProp: string): string => `prop:${targetProp}`;

export const DESIGNER_SESSION_FIELDS: readonly DesignerSessionField[] = [
  'userId',
  'email',
  'role',
  'displayName',
] as const;

export const DESIGNER_SESSION_FIELD_OPTIONS: ReadonlyArray<{
  value: DesignerSessionField;
  label: string;
}> = [
  { value: 'userId', label: 'User ID' },
  { value: 'email', label: 'Email' },
  { value: 'role', label: 'Primary role' },
  { value: 'displayName', label: 'Display name' },
];

/**
 * Maps formal session fields onto the ambient `designerStore.user.*` paths that
 * `designerStoreWithAccessPrincipal` / `buildPreviewDesignerStoreWithAuthUser` already hydrate.
 */
export const SESSION_FIELD_TO_STORE_PATH: Record<DesignerSessionField, string> = {
  userId: 'user.id',
  email: 'user.email',
  role: 'user.role',
  displayName: 'user.displayName',
};

export const isDesignerSessionField = (value: unknown): value is DesignerSessionField =>
  value === 'userId'
  || value === 'email'
  || value === 'role'
  || value === 'displayName';

export const parseDesignerSessionField = (value: unknown): DesignerSessionField | undefined => {
  if (!isDesignerSessionField(value)) {
    return undefined;
  }
  return value;
};

export const resolveSessionFieldStorePath = (sessionField: DesignerSessionField): string =>
  SESSION_FIELD_TO_STORE_PATH[sessionField];

export const isSessionBindingDefinition = (
  definition: DesignerBindingDefinition | null | undefined,
): boolean => definition?.sourceType === 'session';

export const createSessionReadBindingDefinition = (
  targetProp: string,
  sessionField: DesignerSessionField,
): { bindingKey: string; definition: DesignerBindingDefinition } => ({
  bindingKey: propertyBindingKeyForProp(targetProp),
  definition: {
    sourceType: 'session',
    bindingRole: 'property',
    targetProp,
    sessionField,
  },
});

export type ResolvedSessionReadBinding = {
  bindingKey: string;
  nodeId: string;
  targetProp: string;
  sessionField: DesignerSessionField;
  storePath: string;
  definition: DesignerBindingDefinition;
};

export const collectNodeSessionReadBindings = (node: DesignerNode): ResolvedSessionReadBinding[] => {
  const resolved: ResolvedSessionReadBinding[] = [];

  for (const [bindingKey, definition] of Object.entries(node.binding)) {
    if (!definition || !isSessionBindingDefinition(definition)) {
      continue;
    }

    const sessionField = parseDesignerSessionField(definition.sessionField);
    if (!sessionField) {
      continue;
    }

    const targetProp = (
      typeof definition.targetProp === 'string' && definition.targetProp.trim().length > 0
        ? definition.targetProp.trim()
        : bindingKey.startsWith('prop:')
          ? bindingKey.slice('prop:'.length)
          : ''
    ).trim();
    if (!targetProp) {
      continue;
    }

    resolved.push({
      bindingKey,
      nodeId: node.id,
      targetProp,
      sessionField,
      storePath: resolveSessionFieldStorePath(sessionField),
      definition: {
        ...definition,
        sourceType: 'session',
        bindingRole: 'property',
        targetProp,
        sessionField,
      },
    });
  }

  return resolved;
};

export const getNodeSessionReadBindingForProp = (
  node: DesignerNode,
  targetProp: string,
): ResolvedSessionReadBinding | null => {
  for (const binding of collectNodeSessionReadBindings(node)) {
    if (binding.targetProp === targetProp) {
      return binding;
    }
  }
  return null;
};

/** Project session bindings onto store-read shape so Export/Preview reuse store path expressions. */
export const collectNodeSessionAsStoreReadBindings = (node: DesignerNode): ResolvedStoreReadBinding[] =>
  collectNodeSessionReadBindings(node).map((binding) => {
    const path = binding.storePath.includes('.')
      ? binding.storePath.slice(binding.storePath.indexOf('.') + 1)
      : binding.storePath;
    const segmentId = binding.storePath.split('.')[0] ?? 'user';
    return {
      bindingKey: binding.bindingKey,
      nodeId: binding.nodeId,
      targetProp: binding.targetProp,
      segmentId,
      path,
      storePath: binding.storePath,
      definition: binding.definition,
    };
  });

export const formatSessionBoundPlaceholder = (sessionField: DesignerSessionField): string =>
  `[Session: ${sessionField}]`;
