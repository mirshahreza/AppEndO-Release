import type { DesignerDocument, DesignerNode } from './types';
import {
  canAccessManagedFunction,
  type ManagedFunctionAccessPrincipal,
} from '../../shared/api/contracts/server-functions/accessControl';
import {
  compileNodeVisibilityAccessToCondition,
  nodeLayoutHasVisibilityAccess,
  readNodeVisibilityAccessRaw,
  resolveNodeVisibilityAccess,
} from './designerNodeVisibilityAccess';
import { getNodePaletteItemId } from './runtimeShared';

export const EVALUATE_DESIGNER_CONDITION_FN = 'evaluateDesignerCondition';

export const readNodeVisibleCondition = (node: DesignerNode): string => {
  const direct = node.layout.visibleCondition;
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim();
  }

  const rawAccess = readNodeVisibilityAccessRaw(node);
  if (rawAccess !== undefined && rawAccess !== null) {
    const compiled = compileNodeVisibilityAccessToCondition(resolveNodeVisibilityAccess(node));
    return compiled ?? '';
  }

  return '';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const patchStorePath = (
  store: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> => {
  const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) {
    return store;
  }

  const next = { ...store };
  let cursor: Record<string, unknown> = next;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!;
    const existing = cursor[segment];
    const branch = isRecord(existing) ? { ...existing } : {};
    cursor[segment] = branch;
    cursor = branch;
  }

  cursor[segments[segments.length - 1]!] = value;
  return next;
};

/**
 * Hydrate store.user from an access principal so Preview can evaluate the same
 * condition string Export embeds (`evaluateDesignerCondition` + compiled ACL).
 */
export const designerStoreWithAccessPrincipal = (
  designerStore: Record<string, unknown>,
  principal: ManagedFunctionAccessPrincipal | null | undefined,
): Record<string, unknown> => {
  if (!principal) {
    return designerStore;
  }

  let next = designerStore;
  if (principal.userId != null && Number.isFinite(principal.userId)) {
    next = patchStorePath(next, 'user.id', principal.userId);
  }
  if (typeof principal.email === 'string' && principal.email.trim().length > 0) {
    next = patchStorePath(next, 'user.email', principal.email.trim());
  }

  const roles = (principal.roles ?? [])
    .map((role) => role.trim().toUpperCase())
    .filter((role) => role.length > 0);
  if (roles.length > 0) {
    next = patchStorePath(next, 'user.role', roles[0]);
    next = patchStorePath(next, 'user.roles', roles);
  }

  // displayName is not on ManagedFunctionAccessPrincipal — fall back to email for session.displayName.
  if (typeof principal.email === 'string' && principal.email.trim().length > 0) {
    const user = next.user;
    const hasDisplayName = isRecord(user)
      && typeof user.displayName === 'string'
      && user.displayName.trim().length > 0;
    if (!hasDisplayName) {
      next = patchStorePath(next, 'user.displayName', principal.email.trim());
    }
  }

  return next;
};

export const inferPrincipalFromDesignerStore = (
  designerStore: Record<string, unknown>,
): ManagedFunctionAccessPrincipal | null => {
  const user = designerStore.user;
  if (!isRecord(user)) {
    return null;
  }

  const roles = new Set<string>();
  if (typeof user.role === 'string' && user.role.trim().length > 0) {
    roles.add(user.role.trim().toUpperCase());
  }
  if (Array.isArray(user.roles)) {
    for (const role of user.roles) {
      if (typeof role === 'string' && role.trim().length > 0) {
        roles.add(role.trim().toUpperCase());
      }
    }
  }

  const userId = typeof user.id === 'number' ? user.id : Number(user.id);
  const email = typeof user.email === 'string' ? user.email : null;
  const hasIdentity = roles.size > 0 || (Number.isFinite(userId) && userId > 0) || Boolean(email?.trim());

  if (!hasIdentity) {
    return null;
  }

  return {
    isAuthenticated: true,
    roles: [...roles],
    userId: Number.isFinite(userId) ? userId : null,
    email,
  };
};

export const authPrincipalFromAuthUser = (
  user: { id: number; email: string; role: string; roles: string[] } | null | undefined,
): ManagedFunctionAccessPrincipal | null => {
  if (!user) {
    return null;
  }

  const roles = new Set<string>();
  for (const role of user.roles) {
    if (role.trim().length > 0) {
      roles.add(role.trim().toUpperCase());
    }
  }
  if (user.role.trim().length > 0) {
    roles.add(user.role.trim().toUpperCase());
  }

  return {
    isAuthenticated: true,
    roles: [...roles],
    userId: user.id,
    email: user.email,
  };
};

/**
 * Runtime visibility — same condition source as Export codegen
 * (`readNodeVisibleCondition` → `compileNodeVisibilityAccessToCondition` →
 * `evaluateDesignerCondition` / emitted wrapper).
 *
 * Access modes that compile to no expression (public / authenticated) still use
 * `canAccessManagedFunction` when a principal is present.
 */
export const isNodeVisibleForRuntime = (
  node: DesignerNode,
  designerStore: Record<string, unknown>,
  dataContext: Record<string, unknown> | null,
  scope: { item?: unknown; index?: number },
  principal?: ManagedFunctionAccessPrincipal | null,
  options?: { enforceAccessWhenPrincipalMissing?: boolean },
): boolean => {
  const condition = readNodeVisibleCondition(node);
  if (condition.length > 0) {
    const storeForEval = designerStoreWithAccessPrincipal(designerStore, principal);
    return evaluateDesignerCondition(storeForEval, dataContext, scope, condition);
  }

  if (nodeLayoutHasVisibilityAccess(node)) {
    if (principal != null) {
      return canAccessManagedFunction(principal, resolveNodeVisibilityAccess(node));
    }
    if (options?.enforceAccessWhenPrincipalMissing) {
      return false;
    }
  }

  return true;
};

/** CD-J02 — evaluate node visibility for preview role simulation. */
export const isNodeVisibleForPreviewStore = (
  node: DesignerNode,
  designerStore: Record<string, unknown>,
  dataContext: Record<string, unknown> | null = {},
): boolean => isNodeVisibleForRuntime(
  node,
  designerStore,
  dataContext,
  {},
  inferPrincipalFromDesignerStore(designerStore),
);

/**
 * `logic.visibility-container` has its OWN `props.visibleCondition` field (distinct from the
 * generic per-node `node.layout.visibleCondition` "Visible When" / access-control mechanism
 * read by `readNodeVisibleCondition`). It is evaluated the same way (via `evaluateDesignerCondition`)
 * by `DesignerUniversalVisibilityContainer` at runtime, so a document that uses ONLY this palette
 * item must still trigger the same `store` / `evaluateDesignerCondition` codegen preamble that
 * `documentUsesVisibilityConditions` gates — otherwise the generated code would reference an
 * undefined `store`/`evaluateDesignerCondition` symbol.
 */
export const readVisibilityContainerCondition = (node: DesignerNode): string => {
  if (getNodePaletteItemId(node) !== 'logic.visibility-container') {
    return '';
  }

  const raw = node.props.visibleCondition;
  return typeof raw === 'string' ? raw.trim() : '';
};

export const documentUsesVisibilityConditions = (document: DesignerDocument): boolean => {
  for (const node of Object.values(document.nodes)) {
    if (readNodeVisibleCondition(node).length > 0 || readVisibilityContainerCondition(node).length > 0) {
      return true;
    }
  }

  return false;
};

/**
 * Reject expression breakouts before `new Function` (`;`, backticks, eval/Function/import).
 * Path rewrite alone does not stop statement injection inside designer-authored strings.
 */
export const isSafeDesignerRuntimeExpression = (expression: string): boolean => {
  const trimmed = expression.trim();
  if (!trimmed) {
    return true;
  }
  if (/[;`\\]/.test(trimmed) || trimmed.includes('${')) {
    return false;
  }
  if (/\b(?:eval|Function|import|require|constructor|process|globalThis)\b/.test(trimmed)) {
    return false;
  }
  // Allow `new Date(...)` / similar constructors; block other `new` breakouts.
  if (/\bnew\b/.test(trimmed) && !/\bnew\s+Date\s*\(/.test(trimmed)) {
    return false;
  }
  if (trimmed.includes('=>')) {
    return false;
  }
  return true;
};

export const evaluateDesignerCondition = (
  designerStore: Record<string, unknown>,
  dataContext: Record<string, unknown> | null,
  scope: { item?: unknown; index?: number },
  condition: string,
): boolean => {
  const trimmed = condition.trim();
  if (!trimmed) {
    return true;
  }
  if (!isSafeDesignerRuntimeExpression(trimmed)) {
    return false;
  }

  try {
    const compiled = compileDesignerConditionExpression(trimmed);
    const evaluator = new Function(
      'designerStore',
      'dataContext',
      'item',
      'index',
      `return Boolean(${compiled});`,
    ) as (
      designerStore: Record<string, unknown>,
      dataContext: Record<string, unknown> | null,
      item: unknown,
      index: number | undefined,
    ) => boolean;
    return Boolean(evaluator(designerStore, dataContext, scope.item, scope.index));
  } catch {
    return false;
  }
};

/**
 * Builds a safe JS property-access expression string for a dotted path, using bracket
 * notation (`?.[JSON.stringify(segment)]`) for any segment that isn't a valid identifier
 * (e.g. a node id like `heroui-modal-1784195632573-7w6vn`, which contains hyphens — dot
 * notation on a segment like that is invalid JS syntax: `foo.heroui-modal-123` parses as
 * `foo.heroui - modal - 123`, a subtraction chain, not a property access).
 *
 * Node ids are generated with hyphens throughout this codebase (palette-item-id prefix +
 * timestamp + random suffix) and routinely end up as the last segment of a store path
 * (`ui.visibility.<nodeId>`, `dynamic.<nodeId>`). Any code that builds a literal
 * `store.${path}`-style expression string — for codegen output or for a `new
 * Function(...)`-evaluated runtime expression — must go through this, not raw
 * string interpolation, or the resulting code/expression can be syntactically invalid.
 */
export const buildStorePathAccessExpression = (root: string, path: string): string => {
  const chain = path
    .split('.')
    .filter(Boolean)
    .map((segment) => {
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment)) {
        return `.${segment}`;
      }

      return `[${JSON.stringify(segment)}]`;
    })
    .join('');

  return `${root}${chain}`;
};

export const compileDesignerConditionExpression = (condition: string): string => {
  const formatPathChain = (root: string, path: string): string => {
    const chain = path
      .split('.')
      .filter(Boolean)
      .map((segment) => {
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment)) {
          return `?.${segment}`;
        }

        return `?.[${JSON.stringify(segment)}]`;
      })
      .join('');

    return `(${root}${chain})`;
  };

  let compiled = condition.trim();
  if (compiled.length === 0) {
    return 'true';
  }

  compiled = compiled.replace(/\bstore\.([A-Za-z0-9_.-]+)/g, (_, path: string) =>
    formatPathChain('designerStore', path),
  );

  compiled = compiled.replace(/\bdata\.([A-Za-z0-9_.-]+)/g, (_, path: string) =>
    formatPathChain('dataContext', path),
  );

  compiled = compiled.replace(/\bdataContext\.([A-Za-z0-9_.-]+)/g, (_, path: string) =>
    formatPathChain('dataContext', path),
  );

  return compiled;
};

export const renderEvaluateDesignerConditionDefinition = (): string[] => [
  `function ${EVALUATE_DESIGNER_CONDITION_FN}(`,
  '  designerStore: Record<string, unknown>,',
  '  dataContext: Record<string, unknown> | null,',
  '  scope: { item?: unknown; index?: number },',
  '  condition: string,',
  '): boolean {',
  '  const trimmed = condition.trim();',
  '  if (!trimmed) {',
  '    return true;',
  '  }',
  '  try {',
  '    const formatPathChain = (root: string, path: string): string => {',
  '      const chain = path',
  '        .split(\'.\')',
  '        .filter(Boolean)',
  '        .map((segment) => {',
  '          if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment)) {',
  '            return `?.${segment}`;',
  '          }',
  '          return `?.[${JSON.stringify(segment)}]`;',
  '        })',
  '        .join(\'\');',
  '      return `(${root}${chain})`;',
  '    };',
  '    let compiled = trimmed',
  "      .replace(/\\bstore\\.([A-Za-z0-9_.-]+)/g, (_, path: string) => formatPathChain('designerStore', path))",
  "      .replace(/\\bdata\\.([A-Za-z0-9_.-]+)/g, (_, path: string) => formatPathChain('dataContext', path))",
  "      .replace(/\\bdataContext\\.([A-Za-z0-9_.-]+)/g, (_, path: string) => formatPathChain('dataContext', path));",
  "    const evaluator = new Function('designerStore', 'dataContext', 'item', 'index', `return Boolean(${compiled});`);",
  '    return Boolean(evaluator(designerStore, dataContext, scope.item, scope.index));',
  '  } catch {',
  '    return false;',
  '  }',
  '}',
];

export const renderVisibilityConditionJsxWrapper = (
  condition: string,
  innerJsx: string,
  depth: number,
  scopeExpression = '({})',
  wrapAsJsxExpression = true,
): string => {
  const indent = '  '.repeat(depth);
  const childIndent = '  '.repeat(depth + 1);
  const serializedCondition = JSON.stringify(condition);
  const expression = `${EVALUATE_DESIGNER_CONDITION_FN}(designerStore, dataContext, ${scopeExpression}, ${serializedCondition}) && (\n${childIndent}${innerJsx}\n${indent})`;

  if (!wrapAsJsxExpression) {
    return expression;
  }

  return `${indent}{${expression}}`;
};
